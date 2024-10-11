import type Location from '@/models/Location'

export default interface Stop {
  id: number
  start_time: number
  start_id: number
  end_time: number
  end_id: number
  location: Location
}
