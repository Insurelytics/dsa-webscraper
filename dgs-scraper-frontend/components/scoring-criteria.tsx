"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Save, RotateCcw, TestTube } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Placeholder data for current criteria
const defaultCriteria = {
  strongLeads: {
    minAmount: 1000000,
    receivedAfter: "2024-01-01",
    approvedAfter: "2024-01-01",
  },
  weakLeads: {
    minAmount: 250000,
    receivedAfter: "2023-06-01",
    approvedAfter: "2023-06-01",
  },
  watchlist: {
    minAmount: 50000,
    receivedAfter: "2023-01-01",
    approvedAfter: "2023-01-01",
  },
  ignored: {
    minAmount: 0,
    receivedAfter: "2020-01-01",
    approvedAfter: "2020-01-01",
  },
}

export default function ScoringCriteria() {
  const [criteria, setCriteria] = useState(defaultCriteria)
  const [hasChanges, setHasChanges] = useState(false)

  const updateCriteria = (category: string, field: string, value: string | number) => {
    setCriteria((prev) => ({
      ...prev,
      [category]: {
        ...prev[category as keyof typeof prev],
        [field]: value,
      },
    }))
    setHasChanges(true)
  }

  const handleSave = () => {
    console.log("Saving criteria:", criteria)
    setHasChanges(false)
    // Placeholder for save functionality
  }

  const handleReset = () => {
    setCriteria(defaultCriteria)
    setHasChanges(false)
  }

  const handleTest = () => {
    console.log("Testing criteria with current data...")
    // Placeholder for test functionality
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "strongLeads":
        return "bg-green-500"
      case "weakLeads":
        return "bg-yellow-500"
      case "watchlist":
        return "bg-blue-500"
      case "ignored":
        return "bg-gray-500"
      default:
        return "bg-gray-400"
    }
  }

  const getCategoryName = (category: string) => {
    switch (category) {
      case "strongLeads":
        return "Strong Leads"
      case "weakLeads":
        return "Weak Leads"
      case "watchlist":
        return "Watchlist"
      case "ignored":
        return "Ignored"
      default:
        return category
    }
  }

  const renderCriteriaForm = (category: string, data: any) => (
    <Card>
      <CardHeader>
        <div className="flex items-center space-x-3">
          <Badge variant="default" className={getCategoryColor(category)}>
            {getCategoryName(category)}
          </Badge>
          <CardTitle className="text-lg">{getCategoryName(category)} Criteria</CardTitle>
        </div>
        <CardDescription>
          Projects meeting these criteria will be categorized as {getCategoryName(category).toLowerCase()}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`${category}-minAmount`}>Minimum Estimated Amount ($)</Label>
            <Input
              id={`${category}-minAmount`}
              type="number"
              value={data.minAmount}
              onChange={(e) => updateCriteria(category, "minAmount", Number.parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${category}-receivedAfter`}>Received Date After</Label>
            <Input
              id={`${category}-receivedAfter`}
              type="date"
              value={data.receivedAfter}
              onChange={(e) => updateCriteria(category, "receivedAfter", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${category}-approvedAfter`}>Approved Date After</Label>
            <Input
              id={`${category}-approvedAfter`}
              type="date"
              value={data.approvedAfter}
              onChange={(e) => updateCriteria(category, "approvedAfter", e.target.value)}
            />
          </div>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium mb-2">Current Logic:</h4>
          <p className="text-sm text-gray-600">
            Projects with estimated amount ≥ ${data.minAmount.toLocaleString()} AND received after {data.receivedAfter}{" "}
            AND approved after {data.approvedAfter} will be categorized as {getCategoryName(category).toLowerCase()}.
          </p>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Scoring Criteria Configuration</CardTitle>
          <CardDescription>
            Configure the filters used to automatically categorize scraped projects. Projects are evaluated in order:
            Strong Leads → Weak Leads → Watchlist → Ignored.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <Button onClick={handleSave} disabled={!hasChanges}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
            <Button variant="outline" onClick={handleReset} disabled={!hasChanges}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Default
            </Button>
            <Button variant="outline" onClick={handleTest}>
              <TestTube className="h-4 w-4 mr-2" />
              Test Criteria
            </Button>
            {hasChanges && <Badge variant="secondary">Unsaved Changes</Badge>}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="strongLeads" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="strongLeads" className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            Strong Leads
          </TabsTrigger>
          <TabsTrigger value="weakLeads" className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            Weak Leads
          </TabsTrigger>
          <TabsTrigger value="watchlist" className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            Watchlist
          </TabsTrigger>
          <TabsTrigger value="ignored" className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-500"></div>
            Ignored
          </TabsTrigger>
        </TabsList>

        <TabsContent value="strongLeads">{renderCriteriaForm("strongLeads", criteria.strongLeads)}</TabsContent>

        <TabsContent value="weakLeads">{renderCriteriaForm("weakLeads", criteria.weakLeads)}</TabsContent>

        <TabsContent value="watchlist">{renderCriteriaForm("watchlist", criteria.watchlist)}</TabsContent>

        <TabsContent value="ignored">{renderCriteriaForm("ignored", criteria.ignored)}</TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Categorization Preview</CardTitle>
          <CardDescription>Preview how projects would be categorized with current criteria</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">1,234</div>
                <div className="text-sm text-green-700">Strong Leads</div>
              </div>
              <div className="p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">2,456</div>
                <div className="text-sm text-yellow-700">Weak Leads</div>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">3,789</div>
                <div className="text-sm text-blue-700">Watchlist</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-600">8,263</div>
                <div className="text-sm text-gray-700">Ignored</div>
              </div>
            </div>
            <p className="text-sm text-gray-600 text-center">
              Based on current criteria applied to existing project database
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
