export enum LocationType {
    place='place',
    auto='auto',
    region='region',
    waypoint='waypoint',
    ignore='ignore',
}

export default interface Location {
  id: number
  name: string
  latitude: number
  longitude: number
  radius: number
  type: LocationType
}
