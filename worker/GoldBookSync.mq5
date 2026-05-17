//+------------------------------------------------------------------+
//| GoldBookSync.mq5                                                 |
//| Server-side MQL5 Script — runs inside MT5 on your Ubuntu VPS    |
//|                                                                  |
//| Flow:                                                            |
//|   1. Orchestrator launches MT5 with /script:GoldBookSync        |
//|   2. This script runs automatically on MT5 startup              |
//|   3. Reads account balance, open positions, closed deals         |
//|   4. POSTs everything to /api/ea-sync via WebRequest            |
//|   5. Calls TerminalClose(0) so MT5 exits and the thread is done |
//+------------------------------------------------------------------+
#property script_show_inputs

input string ApiUrl      = "https://yourdomain.com/api/ea-sync";
input string SyncToken   = "";
input int    HistoryDays = 90;

//+------------------------------------------------------------------+
void OnStart()
{
   if(SyncToken == "")
   {
      Print("GoldBook: SyncToken is empty — aborting.");
      TerminalClose(0);
      return;
   }

   Print("GoldBook: Starting sync for token=", SyncToken);

   SyncBalance();
   SyncClosedDeals();
   SyncOpenPositions();

   Print("GoldBook: All data pushed. Closing terminal.");
   Sleep(500);
   TerminalClose(0);
}

//+------------------------------------------------------------------+
//| 1. Account balance & equity                                      |
//+------------------------------------------------------------------+
void SyncBalance()
{
   string json = StringFormat(
      "{"
        "\"type\":\"account\","
        "\"sync_token\":\"%s\","
        "\"balance\":%.2f,"
        "\"equity\":%.2f,"
        "\"margin\":%.2f,"
        "\"free_margin\":%.2f,"
        "\"login\":%d,"
        "\"server\":\"%s\","
        "\"currency\":\"%s\","
        "\"name\":\"%s\""
      "}",
      SyncToken,
      AccountInfoDouble(ACCOUNT_BALANCE),
      AccountInfoDouble(ACCOUNT_EQUITY),
      AccountInfoDouble(ACCOUNT_MARGIN),
      AccountInfoDouble(ACCOUNT_MARGIN_FREE),
      AccountInfoInteger(ACCOUNT_LOGIN),
      AccountInfoString(ACCOUNT_SERVER),
      AccountInfoString(ACCOUNT_CURRENCY),
      AccountInfoString(ACCOUNT_NAME)
   );
   Post(json);
}

//+------------------------------------------------------------------+
//| 2. Closed deals from last HistoryDays                           |
//+------------------------------------------------------------------+
void SyncClosedDeals()
{
   datetime fromDate = TimeCurrent() - (datetime)(HistoryDays * 86400);
   if(!HistorySelect(fromDate, TimeCurrent()))
   {
      Print("GoldBook: HistorySelect failed, error=", GetLastError());
      return;
   }

   int total = HistoryDealsTotal();
   if(total == 0) return;

   // ── Pass 1: collect all ENTRY_IN deals ───────────────────────
   ulong  inPosId[]; double inPrice[]; long inTime[]; int inType[];
   int    inCount = 0;
   ArrayResize(inPosId, total);
   ArrayResize(inPrice, total);
   ArrayResize(inTime,  total);
   ArrayResize(inType,  total);

   for(int i = 0; i < total; i++)
   {
      ulong t = HistoryDealGetTicket(i);
      if(!t) continue;
      if((ENUM_DEAL_ENTRY)HistoryDealGetInteger(t, DEAL_ENTRY) == DEAL_ENTRY_IN)
      {
         inPosId[inCount] = HistoryDealGetInteger(t, DEAL_POSITION_ID);
         inPrice[inCount] = HistoryDealGetDouble(t,  DEAL_PRICE);
         inTime[inCount]  = HistoryDealGetInteger(t, DEAL_TIME);
         inType[inCount]  = (int)HistoryDealGetInteger(t, DEAL_TYPE);
         inCount++;
      }
   }

   // ── Pass 2: build JSON for OUT deals ─────────────────────────
   string arr = "[";
   bool   first = true;
   int    count = 0;

   for(int i = 0; i < total; i++)
   {
      ulong t = HistoryDealGetTicket(i);
      if(!t) continue;

      ENUM_DEAL_ENTRY entry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(t, DEAL_ENTRY);
      if(entry != DEAL_ENTRY_OUT && entry != DEAL_ENTRY_INOUT) continue;

      string sym = HistoryDealGetString(t, DEAL_SYMBOL);
      if(sym == "") continue; // skip deposits / balance ops

      long   posId  = HistoryDealGetInteger(t, DEAL_POSITION_ID);
      double vol    = HistoryDealGetDouble(t,  DEAL_VOLUME);
      double exitPx = HistoryDealGetDouble(t,  DEAL_PRICE);
      double profit = HistoryDealGetDouble(t,  DEAL_PROFIT);
      double swap   = HistoryDealGetDouble(t,  DEAL_SWAP);
      double comm   = HistoryDealGetDouble(t,  DEAL_COMMISSION);
      long   ctime  = HistoryDealGetInteger(t, DEAL_TIME);

      // Match with IN deal to get true entry price & direction
      double entryPx = exitPx;
      long   otime   = ctime;
      string dir     = "buy";

      for(int j = 0; j < inCount; j++)
      {
         if(inPosId[j] == posId)
         {
            entryPx = inPrice[j];
            otime   = inTime[j];
            dir     = (inType[j] == DEAL_TYPE_BUY) ? "buy" : "sell";
            break;
         }
      }

      if(!first) arr += ",";
      arr += StringFormat(
         "{\"mt5_ticket\":%d,\"position_id\":%d,\"symbol\":\"%s\","
         "\"direction\":\"%s\",\"lot_size\":%.2f,"
         "\"entry_price\":%.5f,\"exit_price\":%.5f,"
         "\"open_time\":%d,\"close_time\":%d,"
         "\"gross_profit\":%.2f,\"swap\":%.2f,\"commission\":%.2f,"
         "\"net_profit\":%.2f,\"status\":\"closed\"}",
         (long)t, posId, sym, dir, vol,
         entryPx, exitPx, otime, ctime,
         profit, swap, comm, profit + swap + comm
      );
      first = false;
      count++;
   }
   arr += "]";

   if(count == 0) return;

   string json = StringFormat(
      "{\"type\":\"trades\",\"sync_token\":\"%s\",\"trades\":%s}",
      SyncToken, arr
   );
   Post(json);
   Print("GoldBook: Pushed ", count, " closed deal(s)");
}

//+------------------------------------------------------------------+
//| 3. Currently open positions                                      |
//+------------------------------------------------------------------+
void SyncOpenPositions()
{
   int total = PositionsTotal();
   string arr = "[";
   bool first = true;

   for(int i = 0; i < total; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(!ticket) continue;

      if(!first) arr += ",";
      arr += StringFormat(
         "{\"mt5_ticket\":%d,\"position_id\":%d,\"symbol\":\"%s\","
         "\"direction\":\"%s\",\"lot_size\":%.2f,"
         "\"entry_price\":%.5f,\"sl\":%.5f,\"tp\":%.5f,"
         "\"net_profit\":%.2f,\"swap\":%.2f,\"commission\":%.2f,"
         "\"open_time\":%d,\"status\":\"open\"}",
         (long)ticket,
         (long)PositionGetInteger(POSITION_IDENTIFIER),
         PositionGetString(POSITION_SYMBOL),
         PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY ? "buy" : "sell",
         PositionGetDouble(POSITION_VOLUME),
         PositionGetDouble(POSITION_PRICE_OPEN),
         PositionGetDouble(POSITION_SL),
         PositionGetDouble(POSITION_TP),
         PositionGetDouble(POSITION_PROFIT),
         PositionGetDouble(POSITION_SWAP),
         PositionGetDouble(POSITION_COMMISSION),
         (long)PositionGetInteger(POSITION_TIME)
      );
      first = false;
   }
   arr += "]";

   string json = StringFormat(
      "{\"type\":\"positions\",\"sync_token\":\"%s\",\"positions\":%s}",
      SyncToken, arr
   );
   Post(json);
   Print("GoldBook: Pushed ", total, " open position(s)");
}

//+------------------------------------------------------------------+
//| HTTP POST helper                                                 |
//+------------------------------------------------------------------+
void Post(const string &body)
{
   char post[]; char result[]; string resHeaders;
   int len = StringLen(body);
   ArrayResize(post, len);
   StringToCharArray(body, post, 0, len);

   int status = WebRequest(
      "POST", ApiUrl,
      "Content-Type: application/json\r\n",
      5000, post, result, resHeaders
   );

   if(status == -1)
   {
      int err = GetLastError();
      if(err == 4060)
         Print("GoldBook: URL not whitelisted! Add to: Tools > Options > Expert Advisors > WebRequest");
      else
         Print("GoldBook: WebRequest error code=", err);
   }
   else if(status != 200)
      Print("GoldBook: API returned status=", status, " | ", CharArrayToString(result));
}
