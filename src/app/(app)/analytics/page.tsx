'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const monthlyData = [
  { month: 'Jan', pnl: 4500 },
  { month: 'Feb', pnl: -1200 },
  { month: 'Mar', pnl: 3200 },
  { month: 'Apr', pnl: 5100 },
]

const dayData = [
  { day: 'Mon', pnl: 1200 },
  { day: 'Tue', pnl: -500 },
  { day: 'Wed', pnl: 800 },
  { day: 'Thu', pnl: 2100 },
  { day: 'Fri', pnl: -200 },
]

const sessionData = [
  { name: 'London', value: 45 },
  { name: 'NY', value: 35 },
  { name: 'Asian', value: 20 },
]

const COLORS = ['#3B82F6', '#F59E0B', '#22C55E', '#EF4444']

export default function AnalyticsPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-card border border-border w-full justify-start h-auto p-1 overflow-x-auto">
          <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Overview</TabsTrigger>
          <TabsTrigger value="patterns" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Patterns</TabsTrigger>
          <TabsTrigger value="risk" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Risk</TabsTrigger>
          <TabsTrigger value="insights" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Journal Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Trades</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">142</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Win Rate</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">68%</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Profit Factor</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold text-success">2.1</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Avg RR</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold text-primary">1:1.8</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Avg Win</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold text-success">+$450</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Avg Loss</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold text-danger">-$210</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Max Drawdown</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold text-danger">-8.4%</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Commissions Paid</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">-$420</div></CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Monthly PnL</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <XAxis dataKey="month" stroke="var(--muted-foreground)" />
                    <YAxis stroke="var(--muted-foreground)" />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }} />
                    <Bar dataKey="pnl" fill="var(--primary)" radius={[4, 4, 0, 0]}>
                      {monthlyData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.pnl > 0 ? 'var(--success)' : 'var(--danger)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="patterns" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>By Day of Week</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dayData}>
                      <XAxis dataKey="day" stroke="var(--muted-foreground)" />
                      <YAxis stroke="var(--muted-foreground)" />
                      <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }} />
                      <Bar dataKey="pnl" fill="var(--primary)" radius={[4, 4, 0, 0]}>
                        {dayData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.pnl > 0 ? 'var(--success)' : 'var(--danger)'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>By Session (Win Rate)</CardTitle></CardHeader>
              <CardContent className="flex justify-center items-center">
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={sessionData} innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                        {sessionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="risk" className="mt-6">
          <Card>
            <CardHeader><CardTitle>Risk Distribution</CardTitle></CardHeader>
            <CardContent>
              <p className="text-muted-foreground">More risk charts go here...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="mt-6">
          <Card>
            <CardHeader><CardTitle>Emotion vs Outcome</CardTitle></CardHeader>
            <CardContent>
              <p className="text-muted-foreground">More journal insights go here...</p>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  )
}
