import Stop from './Stop'
export default interface Trip {
  id: number
  start_time: number
  start_id: number
  end_time: number
  end_id: number
  stops: Stop[]
}
