"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Download, Eye, RotateCcw, TestTube } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Placeholder data
const categoryData = {
  strongLeads: {
    count: 1234,
    totalValue: 45600000,
    avgValue: 36957,
    lastUpdated: "2024-01-15 14:30:00",
  },
  weakLeads: {
    count: 2456,
    totalValue: 23400000,
    avgValue: 9528,
    lastUpdated: "2024-01-15 14:30:00",
  },
  watchlist: {
    count: 3789,
    totalValue: 12300000,
    avgValue: 3246,
    lastUpdated: "2024-01-15 14:30:00",
  },
  ignored: {
    count: 8263,
    totalValue: 5600000,
    avgValue: 677,
    lastUpdated: "2024-01-15 14:30:00",
  },
}

const sampleProjects = [
  {
    id: "DSA-2024-001",
    name: "Elementary School Modernization",
    county: "Sacramento",
    estimatedAmount: 2500000,
    receivedDate: "2024-01-10",
    approvedDate: "2024-01-12",
    category: "strongLeads",
  },
  {
    id: "DSA-2024-002",
    name: "High School Gymnasium Addition",
    county: "Los Angeles",
    estimatedAmount: 850000,
    receivedDate: "2024-01-08",
    approvedDate: null,
    category: "weakLeads",
  },
  {
    id: "DSA-2024-003",
    name: "Portable Classroom Installation",
    county: "Orange",
    estimatedAmount: 125000,
    receivedDate: "2024-01-05",
    approvedDate: "2024-01-14",
    category: "watchlist",
  },
]

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

interface ResultsAndFiltersProps {
  onSettingsChange: (hasChanges: boolean) => void
}

export default function ResultsAndFilters({ onSettingsChange }: ResultsAndFiltersProps) {
  const [customFilters, setCustomFilters] = useState({
    minAmount: "",
    receivedAfter: "",
    approvedAfter: "",
    county: "All Counties",
  })
  const [criteria, setCriteria] = useState(defaultCriteria)

  const updateCriteria = (category: string, field: string, value: string | number) => {
    setCriteria((prev) => ({
      ...prev,
      [category]: {
        ...prev[category as keyof typeof prev],
        [field]: value,
      },
    }))
    onSettingsChange(true)
  }

  const handleReset = () => {
    setCriteria(defaultCriteria)
    onSettingsChange(false)
  }

  const handleTest = () => {
    console.log("Testing criteria with current data...")
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

  const handleDownload = (category: string) => {
    console.log(`Downloading ${category} projects...`)
  }

  const handleCustomDownload = () => {
    console.log("Downloading with custom filters:", customFilters)
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
      <Tabs defaultValue="results" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="results">Project Results</TabsTrigger>
          <TabsTrigger value="scoring">Scoring Criteria</TabsTrigger>
        </TabsList>

        <TabsContent value="results" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Project Categories</CardTitle>
              <CardDescription>
                Projects are automatically categorized based on your scoring criteria. Download data for each category
                or create custom exports.
              </CardDescription>
            </CardHeader>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Object.entries(categoryData).map(([category, data]) => (
              <Card key={category}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{getCategoryName(category)}</CardTitle>
                    <Badge variant="default" className={getCategoryColor(category)}>
                      {data.count}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total Value:</span>
                      <span className="font-medium">${(data.totalValue / 1000000).toFixed(1)}M</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Avg Value:</span>
                      <span className="font-medium">${data.avgValue.toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-gray-500">Updated: {data.lastUpdated}</div>
                  </div>

                  <div className="flex flex-col space-y-2">
                    <Button size="sm" className="w-full" onClick={() => handleDownload(category)}>
                      <Download className="h-4 w-4 mr-2" />
                      Download Excel
                    </Button>
                    <Button size="sm" variant="outline" className="w-full bg-transparent">
                      <Eye className="h-4 w-4 mr-2" />
                      Edit Criteria
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Custom Export</CardTitle>
              <CardDescription>
                Create a custom export with specific filters applied across all categories.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="space-y-2">
                  <Label htmlFor="minAmount">Minimum Estimated Amount ($)</Label>
                  <Input
                    id="minAmount"
                    type="number"
                    placeholder="e.g., 100000"
                    value={customFilters.minAmount}
                    onChange={(e) => setCustomFilters((prev) => ({ ...prev, minAmount: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="receivedAfter">Received Date After</Label>
                  <Input
                    id="receivedAfter"
                    type="date"
                    value={customFilters.receivedAfter}
                    onChange={(e) => setCustomFilters((prev) => ({ ...prev, receivedAfter: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="approvedAfter">Approved Date After</Label>
                  <Input
                    id="approvedAfter"
                    type="date"
                    value={customFilters.approvedAfter}
                    onChange={(e) => setCustomFilters((prev) => ({ ...prev, approvedAfter: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="countyFilter">County (Optional)</Label>
                  <Select
                    value={customFilters.county}
                    onValueChange={(value) => setCustomFilters((prev) => ({ ...prev, county: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Counties" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All Counties">All Counties</SelectItem>
                      <SelectItem value="Sacramento">Sacramento</SelectItem>
                      <SelectItem value="Los Angeles">Los Angeles</SelectItem>
                      <SelectItem value="San Francisco">San Francisco</SelectItem>
                      <SelectItem value="Orange">Orange</SelectItem>
                      <SelectItem value="San Diego">San Diego</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex space-x-2">
                <Button onClick={handleCustomDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Custom Export
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    setCustomFilters({ minAmount: "", receivedAfter: "", approvedAfter: "", county: "All Counties" })
                  }
                >
                  Clear Filters
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scoring" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Scoring Criteria Configuration</CardTitle>
              <CardDescription>
                Configure the filters used to automatically categorize scraped projects. Projects are evaluated in
                order: Strong Leads → Weak Leads → Watchlist → Ignored.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-4">
                <Button variant="outline" onClick={handleReset}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset to Default
                </Button>
                <Button variant="outline" onClick={handleTest}>
                  <TestTube className="h-4 w-4 mr-2" />
                  Test Criteria
                </Button>
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
        </TabsContent>
      </Tabs>
    </div>
  )
}
