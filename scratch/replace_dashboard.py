import os

filepath = r"components/dashboard/workstation-dashboard.tsx"

with open(filepath, "r", encoding="utf-8") as f:
    lines = f.readlines()

print("Line 312 (index 311):", repr(lines[311]))
print("Line 705 (index 704):", repr(lines[704]))

replacement = """        <div className="flex-1 overflow-y-auto p-6 no-scrollbar relative min-h-0">
          <WidgetLayout
            layout={layout}
            activeDrag={activeDrag}
            placeholder={placeholder}
            startDrag={startDrag}
            updateDrag={updateDrag}
            endDrag={endDrag}
            cols={10}
            rowHeight={70}
            gap={20}
          >
            <div key="rankings" className="w-full h-full">
              <MarketRankings
                activeTab={marketTab}
                filter={filterPill}
                isDark={isDark}
                search={listSearch}
                selectedSymbol={selectedSymbol}
                tickers={rankedTickersList}
                isStarred={isStarred}
                onFilterChange={setFilterPill}
                onSearchChange={setListSearch}
                onSelectTicker={setSelectedSymbol}
                onStarToggle={handleStarToggle}
                onTabChange={setMarketTab}
              />
            </div>

            <div key="chart" className="w-full h-full">
              <MarketChartPanel />
            </div>

            <div key="aiEngine" className="w-full h-full">
              <AIStrategiesPanel />
            </div>

            <div key="orderTicket" className="w-full h-full">
              <OrderTicketPanel />
            </div>

            <div key="positions" className="w-full h-full">
              <PositionsPanel onSelectTicker={setSelectedSymbol} recentlyViewed={recentlyViewed} />
            </div>
          </WidgetLayout>
        </div>
"""

new_lines = lines[:311] + [replacement] + lines[705:]

with open(filepath, "w", encoding="utf-8") as f:
    f.writelines(new_lines)

print("Replacement done!")
