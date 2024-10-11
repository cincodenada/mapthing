import { describe, it, expect } from 'vitest'

import { mount } from '@vue/test-utils'
import Stop from '../Stop.vue'
import StopModel from '@/models/Stop'
import Locations from '@/fixtures/Location'

describe('Stop', () => {
  it('renders properly', () => {
    const wrapper = mount(Stop, { props: {
      stop: {
          start_time: '2024-10-10 20:00:00',
          end_time: '2024-10-11 08:30:00',
          location: Locations.Home,
      }
    } })
    expect(wrapper).toMatchInlineSnapshot(`
      <div class="stop_time">2024/10/10 20:00</div>
      <div class="stop_container place">
          <a ng-if="!event.isEditing" href="#" class="trip_stop">
              <span>Home</span>
          </a>
          <div ng-if="event.isEditing" class="trip_stop">
              <form>
                  <select name="type" ng-model="pendingLoc.type">
                      <option value="region">🏘️</option>
                      <option value="place">👁️</option>
                      <option value="waypoint">🚏</option>
                      <option value="ignore">🗑️</option>
                  </select>
                  <input type="text" ng-model="pendingLoc.name"/>
                  <input type="submit" value="✅"/>
                  <input type="reset" value="❌"/>
              </form>
          </div>
          <span class="stop_latlon">42.5, 122.5</span>
      </div>
      <div class="stop_time">2024/10/11 08:30</div>
    `)
  })
})
