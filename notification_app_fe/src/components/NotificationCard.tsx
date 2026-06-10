import { Card, CardContent, Typography, Chip, Box } from '@mui/material'
import WorkIcon from '@mui/icons-material/Work'
import EventIcon from '@mui/icons-material/Event'
import AssessmentIcon from '@mui/icons-material/Assessment'
import { Notification } from '../types'

const TYPE_CONFIG = {
  Placement: { color: '#2196f3' as const, icon: <WorkIcon fontSize="small" /> },
  Event: { color: '#ff9800' as const, icon: <EventIcon fontSize="small" /> },
  Result: { color: '#4caf50' as const, icon: <AssessmentIcon fontSize="small" /> }
}

interface Props {
  notification: Notification
  isNew: boolean
  score?: number
}

export default function NotificationCard({ notification, isNew, score }: Props) {
  const config = TYPE_CONFIG[notification.Type]
  const timeStr = new Date(notification.Timestamp).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })

  return (
    <Card
      variant="outlined"
      sx={{
        mb: 1.5,
        borderLeft: `4px solid ${config.color}`,
        bgcolor: isNew ? '#f0f7ff' : '#fff',
        transition: 'box-shadow 0.2s',
        '&:hover': { boxShadow: 3 }
      }}
    >
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Chip
            icon={config.icon}
            label={notification.Type}
            size="small"
            sx={{ bgcolor: config.color, color: '#fff', fontWeight: 600, fontSize: '0.7rem' }}
          />
          {isNew && (
            <Chip label="New" size="small" color="primary" sx={{ fontSize: '0.65rem', height: 20 }} />
          )}
          {score !== undefined && (
            <Typography variant="caption" sx={{ ml: 'auto', color: '#999' }}>
              score: {score.toFixed(1)}
            </Typography>
          )}
          <Typography variant="caption" sx={{ ml: score !== undefined ? 0 : 'auto', color: '#999' }}>
            {timeStr}
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color: '#333', fontWeight: isNew ? 500 : 400 }}>
          {notification.Message}
        </Typography>
      </CardContent>
    </Card>
  )
}
