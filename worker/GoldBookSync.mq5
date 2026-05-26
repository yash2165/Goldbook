//+------------------------------------------------------------------+
//|                                             GoldBookSync.mq5     |
//| Server-side MQL5 Expert Advisor — runs inside MT5 terminal       |
//|                                                                  |
//| Flow:                                                            |
//|   1. Launched automatically on MT5 startup as an Expert          |
//|   2. Runs 24/7. Listens to OnTrade() and OnTimer()               |
//|   3. Reads account balance, open positions, closed deals         |
//|   4. Writes JSON to MQL5/Files/sync_result_temp.json             |
//|   5. Atomically moves/renames to sync_result.json                |
//+------------------------------------------------------------------+
#property expert_show_inputs

input string SyncToken   = "";
input int    HistoryDays = 90;

string g_sync_token = "";
datetime g_last_sync_time = 0;

// Forward declarations
void RunSync();
string GetBalanceJson();
string GetClosedDealsJson();
string GetOpenPositionsJson();

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   g_sync_token = SyncToken;

   // Read config file from MQL5/Files/sync_config.txt if empty
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
      Print("GoldBook: SyncToken is empty — EA will not start.");
      return(INIT_FAILED);
   }

   Print("GoldBook: EA started successfully for token=", g_sync_token);
   
   // Set timer to trigger sync every 60 seconds
   EventSetTimer(60);
   
   // Run initial sync after a short delay to allow terminal to establish connection
   EventSetTimer(5); // Temporarily set short timer to trigger first sync in 5 seconds
   
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   Print("GoldBook: EA stopped.");
}

//+------------------------------------------------------------------+
//| Timer event function                                             |
//+------------------------------------------------------------------+
void OnTimer()
{
   // If we set the 5-second initial startup timer, restore it to 60 seconds
   static bool initial_sync_done = false;
   if(!initial_sync_done)
   {
      EventKillTimer();
      EventSetTimer(60);
      initial_sync_done = true;
   }
   
   RunSync();
}

//+------------------------------------------------------------------+
//| Trade event function (fires on transaction/order/position change)|
//+------------------------------------------------------------------+
void OnTrade()
{
   // Throttling: Avoid excessive syncs if many trades are updated in less than 2 seconds
   datetime now = TimeCurrent();
   if(now - g_last_sync_time >= 2)
   {
      Print("GoldBook: Trade event detected — triggering sync.");
      RunSync();
   }
}

//+------------------------------------------------------------------+
//| Sync routine                                                     |
//+------------------------------------------------------------------+
void RunSync()
{
   // Check connection status
   if(!TerminalInfoInteger(TERMINAL_CONNECTED))
   {
      Print("GoldBook: Warning — Not connected to trade server.");
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

   // Write to temporary file to avoid sharing violations during read
   int out_handle = FileOpen("sync_result_temp.json", FILE_WRITE|FILE_TXT|FILE_ANSI);
   if(out_handle != INVALID_HANDLE)
   {
      FileWriteString(out_handle, final_json);
      FileClose(out_handle);
      
      // Move/rename to sync_result.json atomically
      if(FileMove("sync_result_temp.json", 0, "sync_result.json", FILE_REWRITE))
      {
         g_last_sync_time = TimeCurrent();
         Print("GoldBook: Sync data successfully written to sync_result.json");
      }
      else
      {
         Print("GoldBook: Failed to rename temp file. Error=", GetLastError());
      }
   }
   else
   {
      Print("GoldBook: Failed to write sync_result_temp.json. Error=", GetLastError());
   }
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
   
   string arr = "[";
   bool first = true;
   int count = 0;
   
   for(int i = 0; i < total; i++)
   {
      ulong t = HistoryDealGetTicket(i);
      if(!t) continue;
      
      string sym = HistoryDealGetString(t, DEAL_SYMBOL);
      if(sym == "") continue; // skip balance ops
      
      long   posId  = HistoryDealGetInteger(t, DEAL_POSITION_ID);
      int    entry  = (int)HistoryDealGetInteger(t, DEAL_ENTRY);
      int    type   = (int)HistoryDealGetInteger(t, DEAL_TYPE);
      double vol    = HistoryDealGetDouble(t,  DEAL_VOLUME);
      double price  = HistoryDealGetDouble(t,  DEAL_PRICE);
      double profit = HistoryDealGetDouble(t,  DEAL_PROFIT);
      double swap   = HistoryDealGetDouble(t,  DEAL_SWAP);
      double comm   = HistoryDealGetDouble(t,  DEAL_COMMISSION);
      long   time   = HistoryDealGetInteger(t, DEAL_TIME);
      
      if(!first) arr += ",";
      arr += StringFormat(
         "{\"ticket\":%d,\"position_id\":%d,\"symbol\":\"%s\","
         "\"entry\":%d,\"type\":%d,\"volume\":%.2f,"
         "\"price\":%.5f,\"profit\":%.2f,\"swap\":%.2f,\"commission\":%.2f,"
         "\"time\":%d}",
         (long)t, posId, sym, entry, type, vol, price, profit, swap, comm, time
      );
      first = false;
      count++;
   }
   arr += "]";
   
   if(count == 0) return "";
   
   return StringFormat(
      "{\"type\":\"raw_trades\",\"sync_token\":\"%s\",\"raw_trades\":%s}",
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
