"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Clock, Play } from "lucide-react"

// Placeholder data for current schedules
const defaultSchedules = {
  watchlistRescrape: {
    enabled: true,
    frequency: "daily",
    time: "02:00",
    lastRun: "2024-01-15 02:00:00",
    nextRun: "2024-01-16 02:00:00",
  },
  fullRescrape: {
    enabled: true,
    frequency: "weekly",
    time: "01:00",
    day: "sunday",
    lastRun: "2024-01-14 01:00:00",
    nextRun: "2024-01-21 01:00:00",
  },
  leadsRescrape: {
    enabled: true,
    frequency: "daily",
    time: "06:00",
    lastRun: "2024-01-15 06:00:00",
    nextRun: "2024-01-16 06:00:00",
  },
}

interface ScheduleSettingsProps {
  onSettingsChange: (hasChanges: boolean) => void
}

export default function ScheduleSettings({ onSettingsChange }: ScheduleSettingsProps) {
  const [schedules, setSchedules] = useState(defaultSchedules)

  const updateSchedule = (scheduleType: string, field: string, value: any) => {
    setSchedules((prev) => ({
      ...prev,
      [scheduleType]: {
        ...prev[scheduleType as keyof typeof prev],
        [field]: value,
      },
    }))
    onSettingsChange(true)
  }

  const getStatusBadge = (enabled: boolean, nextRun: string) => {
    if (!enabled) {
      return <Badge variant="secondary">Disabled</Badge>
    }

    const nextRunDate = new Date(nextRun)
    const now = new Date()

    if (nextRunDate > now) {
      return (
        <Badge variant="default" className="bg-green-500">
          Scheduled
        </Badge>
      )
    } else {
      return (
        <Badge variant="default" className="bg-blue-500">
          Running
        </Badge>
      )
    }
  }

  const formatNextRun = (nextRun: string) => {
    const date = new Date(nextRun)
    const now = new Date()
    const diffMs = date.getTime() - now.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

    if (diffHours > 0) {
      return `in ${diffHours}h ${diffMinutes}m`
    } else if (diffMinutes > 0) {
      return `in ${diffMinutes}m`
    } else {
      return "now"
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="h-5 w-5" />
                  <span>Watchlist Rescrape</span>
                </CardTitle>
                <CardDescription>Regular updates for watchlist projects to track status changes</CardDescription>
              </div>
              {getStatusBadge(schedules.watchlistRescrape.enabled, schedules.watchlistRescrape.nextRun)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="watchlist-enabled">Enable Schedule</Label>
              <Switch
                id="watchlist-enabled"
                checked={schedules.watchlistRescrape.enabled}
                onCheckedChange={(checked) => updateSchedule("watchlistRescrape", "enabled", checked)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="watchlist-frequency">Frequency</Label>
                <Select
                  value={schedules.watchlistRescrape.frequency}
                  onValueChange={(value) => updateSchedule("watchlistRescrape", "frequency", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="watchlist-time">Time</Label>
                <Input
                  id="watchlist-time"
                  type="time"
                  value={schedules.watchlistRescrape.time}
                  onChange={(e) => updateSchedule("watchlistRescrape", "time", e.target.value)}
                />
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-gray-600">Last Run:</span>
                <span>{schedules.watchlistRescrape.lastRun}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Next Run:</span>
                <span>
                  {schedules.watchlistRescrape.nextRun} ({formatNextRun(schedules.watchlistRescrape.nextRun)})
                </span>
              </div>
            </div>

            <Button variant="outline" className="w-full bg-transparent">
              <Play className="h-4 w-4 mr-2" />
              Run Now
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="h-5 w-5" />
                  <span>Leads Rescrape</span>
                </CardTitle>
                <CardDescription>
                  Regular updates for strong and weak lead projects to track status changes
                </CardDescription>
              </div>
              {getStatusBadge(schedules.leadsRescrape.enabled, schedules.leadsRescrape.nextRun)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="strongleads-enabled">Enable Schedule</Label>
              <Switch
                id="strongleads-enabled"
                checked={schedules.leadsRescrape.enabled}
                onCheckedChange={(checked) => updateSchedule("leadsRescrape", "enabled", checked)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="strongleads-frequency">Frequency</Label>
                <Select
                  value={schedules.leadsRescrape.frequency}
                  onValueChange={(value) => updateSchedule("leadsRescrape", "frequency", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="strongleads-time">Time</Label>
                <Input
                  id="strongleads-time"
                  type="time"
                  value={schedules.leadsRescrape.time}
                  onChange={(e) => updateSchedule("leadsRescrape", "time", e.target.value)}
                />
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-gray-600">Last Run:</span>
                <span>{schedules.leadsRescrape.lastRun}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Next Run:</span>
                <span>
                  {schedules.leadsRescrape.nextRun} ({formatNextRun(schedules.leadsRescrape.nextRun)})
                </span>
              </div>
            </div>

            <Button variant="outline" className="w-full bg-transparent">
              <Play className="h-4 w-4 mr-2" />
              Run Now
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>Full Database Rescrape</span>
              </CardTitle>
              <CardDescription>
                Complete rescrape of all selected counties (less frequent, comprehensive update)
              </CardDescription>
            </div>
            {getStatusBadge(schedules.fullRescrape.enabled, schedules.fullRescrape.nextRun)}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="full-enabled">Enable Schedule</Label>
            <Switch
              id="full-enabled"
              checked={schedules.fullRescrape.enabled}
              onCheckedChange={(checked) => updateSchedule("fullRescrape", "enabled", checked)}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="full-frequency">Frequency</Label>
              <Select
                value={schedules.fullRescrape.frequency}
                onValueChange={(value) => updateSchedule("fullRescrape", "frequency", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {schedules.fullRescrape.frequency === "monthly" && (
              <div className="col-span-3 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
                Monthly schedules will run on the 1st day of each month at the specified time.
              </div>
            )}

            {schedules.fullRescrape.frequency === "weekly" && (
              <div className="space-y-2">
                <Label htmlFor="full-day">Day of Week</Label>
                <Select
                  value={schedules.fullRescrape.day}
                  onValueChange={(value) => updateSchedule("fullRescrape", "day", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sunday">Sunday</SelectItem>
                    <SelectItem value="monday">Monday</SelectItem>
                    <SelectItem value="tuesday">Tuesday</SelectItem>
                    <SelectItem value="wednesday">Wednesday</SelectItem>
                    <SelectItem value="thursday">Thursday</SelectItem>
                    <SelectItem value="friday">Friday</SelectItem>
                    <SelectItem value="saturday">Saturday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="full-time">Time</Label>
              <Input
                id="full-time"
                type="time"
                value={schedules.fullRescrape.time}
                onChange={(e) => updateSchedule("fullRescrape", "time", e.target.value)}
              />
            </div>
          </div>

          <div className="p-3 bg-gray-50 rounded-lg text-sm">
            <div className="flex justify-between mb-1">
              <span className="text-gray-600">Last Run:</span>
              <span>{schedules.fullRescrape.lastRun}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Next Run:</span>
              <span>
                {schedules.fullRescrape.nextRun} ({formatNextRun(schedules.fullRescrape.nextRun)})
              </span>
            </div>
          </div>

          <Button variant="outline" className="w-full bg-transparent">
            <Play className="h-4 w-4 mr-2" />
            Run Now
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
