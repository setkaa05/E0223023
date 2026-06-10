import { useEffect, useState, useCallback } from 'react'
import {
  Box, Container, Typography, CircularProgress, Alert,
  ToggleButtonGroup, ToggleButton, Slider, Divider, Paper
} from '@mui/material'
import StarIcon from '@mui/icons-material/Star'
import { fetchNotifications } from '../services/api'
import { Notification, NotificationType } from '../types'
import { getTopN } from '../utils/priority'
import NotificationCard from '../components/NotificationCard'
import { Log } from '../lib/logger'

export default function PriorityInbox() {
  const [all, setAll] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [topN, setTopN] = useState(10)
  const [typeFilter, setTypeFilter] = useState<NotificationType | ''>('')
  const [viewedIds] = useState<Set<string>>(() => {
    const stored = localStorage.getItem('viewedNotifIds')
    return new Set(stored ? JSON.parse(stored) : [])
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      await Log('frontend', 'info', 'component', `Loading priority inbox topN=${topN}`)
      // fetch a larger set so we have enough to rank
      const data = await fetchNotifications({ limit: 100 })
      setAll(data)
    } catch (err) {
      await Log('frontend', 'error', 'service', `Priority inbox load failed: ${err}`)
      setError('Could not load notifications.')
    } finally {
      setLoading(false)
    }
  }, [topN])

  useEffect(() => {
    load()
  }, [load])

  const filtered = typeFilter
    ? all.filter(n => n.Type === typeFilter)
    : all

  const prioritized = getTopN(filtered, topN)

  const isNew = (id: string) => !viewedIds.has(id)

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <StarIcon sx={{ color: '#f59e0b' }} />
        <Typography variant="h5" fontWeight={700}>
          Priority Inbox
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Ranked by importance (Placement &gt; Result &gt; Event) and recency.
      </Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          <Box sx={{ minWidth: 220 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Show top {topN} notifications
            </Typography>
            <Slider
              value={topN}
              min={5}
              max={20}
              step={5}
              marks={[
                { value: 5, label: '5' },
                { value: 10, label: '10' },
                { value: 15, label: '15' },
                { value: 20, label: '20' }
              ]}
              onChange={(_, val) => setTopN(val as number)}
              color="primary"
            />
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
              Filter by type
            </Typography>
            <ToggleButtonGroup
              value={typeFilter}
              exclusive
              onChange={(_, val) => setTypeFilter(val ?? '')}
              size="small"
            >
              <ToggleButton value="">All</ToggleButton>
              <ToggleButton value="Placement">Placement</ToggleButton>
              <ToggleButton value="Event">Event</ToggleButton>
              <ToggleButton value="Result">Result</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Box>
      </Paper>

      <Divider sx={{ mb: 2 }} />

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {!loading && !error && prioritized.length === 0 && (
        <Typography color="text.secondary" textAlign="center" py={6}>
          No notifications to show.
        </Typography>
      )}

      {!loading && prioritized.map((n, i) => (
        <Box key={n.ID} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <Typography
            variant="caption"
            sx={{ mt: 2, minWidth: 24, textAlign: 'right', color: '#999', fontWeight: 600 }}
          >
            #{i + 1}
          </Typography>
          <Box sx={{ flex: 1 }}>
            <NotificationCard notification={n} isNew={isNew(n.ID)} score={n.score} />
          </Box>
        </Box>
      ))}
    </Container>
  )
}
