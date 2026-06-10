import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material'
import NotificationsIcon from '@mui/icons-material/Notifications'
import StarIcon from '@mui/icons-material/Star'
import { useNavigate, useLocation } from 'react-router-dom'

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <AppBar position="sticky" elevation={1} sx={{ bgcolor: '#1a1a2e' }}>
      <Toolbar sx={{ gap: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, flexGrow: 1, letterSpacing: 0.5 }}>
          Campus Notifications
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            startIcon={<NotificationsIcon />}
            onClick={() => navigate('/')}
            variant={location.pathname === '/' ? 'contained' : 'text'}
            sx={{ color: '#fff', borderColor: '#fff' }}
          >
            All
          </Button>
          <Button
            startIcon={<StarIcon />}
            onClick={() => navigate('/priority')}
            variant={location.pathname === '/priority' ? 'contained' : 'text'}
            sx={{ color: '#fff', borderColor: '#fff' }}
          >
            Priority Inbox
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  )
}
