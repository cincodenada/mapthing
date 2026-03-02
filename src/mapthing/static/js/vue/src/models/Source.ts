import Trip from './Trip'
export default interface Source {
  id: number
  start: number
  end: number
  trip: Trip[]
}
