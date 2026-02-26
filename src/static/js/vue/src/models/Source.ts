import Subtrack from './Subtrack'
export default interface Source {
  id: number
  start: number
  end: number
  subtracks: Subtrack[]
}
