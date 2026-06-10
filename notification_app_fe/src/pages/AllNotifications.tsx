import { useEffect, useState, useCallback } from 'react'
import {
  Box, Container, Typography, CircularProgress, Alert,
  ToggleButtonGroup, ToggleButton, Pagination, Divider
} from '@mui/material'
import { fetchNotifications } from '../services/api'
import { Notification, NotificationType } from '../types'
import NotificationCard from '../components/NotificationCard'
import { Log } from '../lib/logger'

const PAGE_SIZE = 10

export default function AllNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [typeFilter, setTypeFilter] = useState<NotificationType | ''>('')
  const [viewedIds] = useState<Set<string>>(() => {
    const stored = localStorage.getItem('viewedNotifIds')
    return new Set(stored ? JSON.parse(stored) : [])
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      await Log('frontend', 'info', 'component', `Loading notifications page=${page} type=${typeFilter || 'all'}`)
      const data = await fetchNotifications({
        page,
        limit: PAGE_SIZE,
        notification_type: typeFilter || undefined
      })
      setNotifications(data)
      // estimate total pages — test server doesn't return total count
      setTotalPages(data.length === PAGE_SIZE ? page + 1 : page)

      // mark fetched notifications as viewed
      const updated = new Set(viewedIds)
      data.forEach(n => updated.add(n.ID))
      localStorage.setItem('viewedNotifIds', JSON.stringify([...updated]))
    } catch (err) {
      await Log('frontend', 'error', 'service', `Failed to load notifications: ${err}`)
      setError('Could not load notifications. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [page, typeFilter, viewedIds])

  useEffect(() => {
    load()
  }, [load])

  const handleTypeChange = (_: React.MouseEvent<HTMLElement>, val: NotificationType | '') => {
    setTypeFilter(val ?? '')
    setPage(1)
  }

  const isNew = (id: string) => !viewedIds.has(id)

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Typography variant="h5" fontWeight={700} mb={0.5}>
        All Notifications
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Showing updates for placements, events, and results.
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <ToggleButtonGroup
          value={typeFilter}
          exclusive
          onChange={handleTypeChange}
          size="small"
        >
          <ToggleButton value="">All</ToggleButton>
          <ToggleButton value="Placement">Placement</ToggleButton>
          <ToggleButton value="Event">Event</ToggleButton>
          <ToggleButton value="Result">Result</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Divider sx={{ mb: 2 }} />

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {!loading && !error && notifications.length === 0 && (
        <Typography color="text.secondary" textAlign="center" py={6}>
          No notifications found.
        </Typography>
      )}

      {!loading && notifications.map(n => (
        <NotificationCard key={n.ID} notification={n} isNew={isNew(n.ID)} />
      ))}

      {!loading && totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, val) => setPage(val)}
            color="primary"
          />
        </Box>
      )}
    </Container>
  )
}
