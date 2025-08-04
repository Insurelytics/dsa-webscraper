"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Download, Filter, Eye } from "lucide-react"

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

export default function ProjectCategories() {
  const [customFilters, setCustomFilters] = useState({
    minAmount: "",
    receivedAfter: "",
    approvedAfter: "",
  })

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
    // Placeholder for download functionality
  }

  const handleCustomDownload = () => {
    console.log("Downloading with custom filters:", customFilters)
    // Placeholder for custom download functionality
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Project Categories</CardTitle>
          <CardDescription>
            Projects are automatically categorized based on your scoring criteria. Download data for each category or
            create custom exports.
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
                  View Projects
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Custom Export</CardTitle>
          <CardDescription>Create a custom export with specific filters applied across all categories.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
          </div>

          <div className="flex space-x-2">
            <Button onClick={handleCustomDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download Custom Export
            </Button>
            <Button
              variant="outline"
              onClick={() => setCustomFilters({ minAmount: "", receivedAfter: "", approvedAfter: "" })}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Projects</CardTitle>
          <CardDescription>Sample of recently categorized projects</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sampleProjects.map((project) => (
              <div key={project.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <Badge variant="default" className={getCategoryColor(project.category)}>
                      {getCategoryName(project.category)}
                    </Badge>
                    <h3 className="font-medium">{project.name}</h3>
                  </div>
                  <div className="mt-2 text-sm text-gray-600">
                    <span>{project.county} County</span> •
                    <span className="ml-1">${project.estimatedAmount.toLocaleString()}</span> •
                    <span className="ml-1">Received: {project.receivedDate}</span>
                    {project.approvedDate && <span className="ml-1">• Approved: {project.approvedDate}</span>}
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button size="sm" variant="outline">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline">
                    <Filter className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
