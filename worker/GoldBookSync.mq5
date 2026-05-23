//+------------------------------------------------------------------+
//| GoldBookSync.mq5                                                 |
//| Server-side MQL5 Script — runs inside MetaTrader 5 terminal      |
//|                                                                  |
//| Flow:                                                            |
//|   1. Orchestrator launches MT5 with /script:GoldBookSync        |
//|   2. This script runs automatically on MT5 startup              |
//|   3. Reads account balance, open positions, closed deals         |
//|   4. Writes everything to MQL5/Files/sync_result.json           |
//|   5. Calls TerminalClose(0) so MT5 exits and the thread is done |
//+------------------------------------------------------------------+
#property script_show_inputs

input string SyncToken   = "";
input int    HistoryDays = 90;

string g_sync_token = "";

//+------------------------------------------------------------------+
void OnStart()
{
   g_sync_token = SyncToken;

   // Read config file from MQL5/Files/sync_config.txt if it exists
   int file_handle = FileOpen("sync_config.txt", FILE_READ|FILE_ANSI|FILE_TXT);
   if(file_handle != INVALID_HANDLE)
   {
      while(!FileIsEnding(file_handle))
      {
         string line = FileReadString(file_handle);
         int eq_idx = StringFind(line, "=");
         if(eq_idx > 0)
         {
            string key = StringSubstr(line, 0, eq_idx);
            string val = StringSubstr(line, eq_idx + 1);
            StringTrimLeft(key); StringTrimRight(key);
            StringTrimLeft(val); StringTrimRight(val);
            if(key == "SyncToken") g_sync_token = val;
         }
      }
      FileClose(file_handle);
   }

   if(g_sync_token == "")
   {
      Print("GoldBook: SyncToken is empty — aborting.");
      TerminalClose(2);
      return;
   }

   Print("GoldBook: Starting sync for token=", g_sync_token);

   // Wait up to 20 seconds for connection to the trade server
   int max_wait = 20;
   while(!TerminalInfoInteger(TERMINAL_CONNECTED) && max_wait > 0)
   {
      Print("GoldBook: Waiting for connection to trade server... (attempts remaining: ", max_wait, ")");
      Sleep(1000);
      max_wait--;
   }

   if(!TerminalInfoInteger(TERMINAL_CONNECTED))
   {
      Print("GoldBook: Warning — Not connected to trade server. Balance and history snapshots might be incomplete or zero.");
   }
   else
   {
      Print("GoldBook: Connected to trade server successfully. Resting 2s for history synchronisation...");
      Sleep(2000);
   }

   string account_json = GetBalanceJson();
   string trades_json = GetClosedDealsJson();
   string positions_json = GetOpenPositionsJson();

   // Combine into a single massive JSON array
   string final_json = "[";
   final_json += account_json;
   
   if (trades_json != "") final_json += "," + trades_json;
   if (positions_json != "") final_json += "," + positions_json;
   
   final_json += "]";

   // Write to result file
   int out_handle = FileOpen("sync_result.json", FILE_WRITE|FILE_TXT|FILE_ANSI);
   if(out_handle != INVALID_HANDLE)
   {
      FileWriteString(out_handle, final_json);
      FileClose(out_handle);
      Print("GoldBook: Data written to sync_result.json");
   }
   else
   {
      Print("GoldBook: Failed to write sync_result.json. Error=", GetLastError());
   }

   Print("GoldBook: All data processed. Closing terminal.");
   Sleep(500);
   TerminalClose(0);
}

//+------------------------------------------------------------------+
//| 1. Account balance & equity                                      |
//+------------------------------------------------------------------+
string GetBalanceJson()
{
   return StringFormat(
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
      g_sync_token,
      AccountInfoDouble(ACCOUNT_BALANCE),
      AccountInfoDouble(ACCOUNT_EQUITY),
      AccountInfoDouble(ACCOUNT_MARGIN),
      AccountInfoDouble(ACCOUNT_MARGIN_FREE),
      AccountInfoInteger(ACCOUNT_LOGIN),
      AccountInfoString(ACCOUNT_SERVER),
      AccountInfoString(ACCOUNT_CURRENCY),
      AccountInfoString(ACCOUNT_NAME)
   );
}

//+------------------------------------------------------------------+
//| 2. Closed deals from last HistoryDays                           |
//+------------------------------------------------------------------+
string GetClosedDealsJson()
{
   datetime fromDate = TimeCurrent() - (datetime)(HistoryDays * 86400);
   if(!HistorySelect(fromDate, TimeCurrent())) return "";

   int total = HistoryDealsTotal();
   if(total == 0) return "";

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

   if(count == 0) return "";

   return StringFormat(
      "{\"type\":\"trades\",\"sync_token\":\"%s\",\"trades\":%s}",
      g_sync_token, arr
   );
}

//+------------------------------------------------------------------+
//| 3. Currently open positions                                      |
//+------------------------------------------------------------------+
string GetOpenPositionsJson()
{
   int total = PositionsTotal();
   if(total == 0) return "";
   
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

   return StringFormat(
      "{\"type\":\"positions\",\"sync_token\":\"%s\",\"positions\":%s}",
      g_sync_token, arr
   );
}
