"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Search, Play, Clock, CheckCircle } from "lucide-react"

interface CountySelectionProps {
  onSettingsChange: (hasChanges: boolean) => void
}

const counties = [
  "Alameda",
  "Kings",
  "Placer",
  "Sierra",
  "Alpine",
  "Lake",
  "Plumas",
  "Siskiyou",
  "Amador",
  "Lassen",
  "Riverside",
  "Solano",
  "Butte",
  "Los Angeles",
  "Sacramento",
  "Sonoma",
  "Calaveras",
  "Madera",
  "San Benito",
  "Stanislaus",
  "Colusa",
  "Marin",
  "San Bernardino",
  "Sutter",
  "Contra Costa",
  "Mariposa",
  "San Diego",
  "Tehama",
  "Del Norte",
  "Mendocino",
  "San Francisco",
  "Trinity",
  "El Dorado",
  "Merced",
  "San Joaquin",
  "Tulare",
  "Fresno",
  "Modoc",
  "San Luis Obispo",
  "Tuolumne",
  "Glenn",
  "Mono",
  "San Mateo",
  "Ventura",
  "Humboldt",
  "Monterey",
  "Santa Barbara",
  "Yolo",
  "Imperial",
  "Napa",
  "Santa Clara",
  "Yuba",
  "Inyo",
  "Nevada",
  "Santa Cruz",
  "Kern",
  "Orange",
  "Shasta",
]

// Placeholder data for county status
const countyStatus = {
  Sacramento: {
    lastScraped: "2024-01-15 14:30:00",
    totalScraped: "2024-01-15 14:30:00",
    projects: 234,
    status: "complete",
  },
  "Los Angeles": {
    lastScraped: "2024-01-15 12:15:00",
    totalScraped: "2024-01-14 09:20:00",
    projects: 1456,
    status: "running",
  },
  "San Francisco": {
    lastScraped: "2024-01-14 16:45:00",
    totalScraped: "2024-01-14 16:45:00",
    projects: 89,
    status: "complete",
  },
  Orange: {
    lastScraped: "2024-01-13 11:20:00",
    totalScraped: "2024-01-13 11:20:00",
    projects: 567,
    status: "complete",
  },
  "San Diego": {
    lastScraped: "2024-01-12 08:30:00",
    totalScraped: "2024-01-12 08:30:00",
    projects: 445,
    status: "scheduled",
  },
}

export default function CountySelection({ onSettingsChange }: CountySelectionProps) {
  const [selectedCounties, setSelectedCounties] = useState<string[]>([
    "Sacramento",
    "Los Angeles",
    "San Francisco",
    "Orange",
    "San Diego",
  ])
  const [searchTerm, setSearchTerm] = useState("")
  const [showSelectedOnly, setShowSelectedOnly] = useState(false)

  const filteredCounties = counties.filter((county) => {
    const matchesSearch = county.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = showSelectedOnly ? selectedCounties.includes(county) : true
    return matchesSearch && matchesFilter
  })

  const handleCountyToggle = (county: string) => {
    if (selectedCounties.includes(county)) {
      // Show confirmation when unchecking
      if (confirm(`Are you sure you want to remove ${county} from your scrape list?`)) {
        setSelectedCounties((prev) => prev.filter((c) => c !== county))
        onSettingsChange(true)
      }
    } else {
      setSelectedCounties((prev) => [...prev, county])
      onSettingsChange(true)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "complete":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "running":
        return <Play className="h-4 w-4 text-blue-500" />
      case "scheduled":
        return <Clock className="h-4 w-4 text-yellow-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "complete":
        return (
          <Badge variant="default" className="bg-green-500">
            Complete
          </Badge>
        )
      case "running":
        return (
          <Badge variant="default" className="bg-blue-500">
            Running
          </Badge>
        )
      case "scheduled":
        return <Badge variant="secondary">Scheduled</Badge>
      default:
        return <Badge variant="outline">Not Scraped</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>County Selection</CardTitle>
          <CardDescription>
            Build your custom scrape list by selecting counties. Selected counties will be included in scheduled
            scraping jobs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search counties..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" onClick={() => setShowSelectedOnly(!showSelectedOnly)}>
              {showSelectedOnly ? "Show All" : "Show Selected"}
            </Button>
          </div>

          <div className="text-sm text-gray-600">
            {selectedCounties.length} of {counties.length} counties selected
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCounties.map((county) => {
          const isSelected = selectedCounties.includes(county)
          const status = countyStatus[county as keyof typeof countyStatus]

          return (
            <Card
              key={county}
              className={`cursor-pointer transition-all ${isSelected ? "ring-2 ring-blue-500 bg-blue-50" : "hover:shadow-md"}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <Checkbox checked={isSelected} onCheckedChange={() => handleCountyToggle(county)} />
                    <div>
                      <h3 className="font-medium">{county}</h3>
                      {status && (
                        <div className="space-y-1 mt-2">
                          <div className="flex items-center space-x-2 text-xs text-gray-600">
                            {getStatusIcon(status.status)}
                            <span>Projects: {status.projects}</span>
                          </div>
                          <div className="text-xs text-gray-500">Last scraped: {status.lastScraped}</div>
                          <div className="text-xs text-gray-500">Total scraped: {status.totalScraped}</div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end space-y-2">
                    {status && getStatusBadge(status.status)}
                    {isSelected && (
                      <Button size="sm" variant="outline">
                        Scrape Now
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
