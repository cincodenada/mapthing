import { describe, it, expect } from 'vitest'

import { mount } from '@vue/test-utils'
import xmlFormat from 'xml-formatter'
import { promisify } from 'util'

import Stop from '../Stop.vue'
import StopModel from '@/models/Stop'
import Locations from '@/fixtures/Location'

const clean = (html) => {
  const out = xmlFormat(`<root>${html}</root>`, { collapseContent: true, indentation: '  ' })
  return out.split('\n').slice(1,-1).join('\n').replaceAll(/^  /mg,'');
}

describe('Stop', () => {
  it('renders properly', () => {
    const wrapper = mount(Stop, { props: {
      stop: {
          start_time: '2024-10-10 20:00:00',
          end_time: '2024-10-11 08:30:00',
          location: Locations.Home,
      }
    } })
    expect(clean(wrapper.html())).toMatchInlineSnapshot(`
      <div class="stop_time">2024/10/10 20:00</div>
      <div class="stop_container place">
        <a href="#" class="trip_stop">
          <span>Home</span>
        </a>
        <span class="stop_latlon">42.5, 122.5</span>
      </div>
      <div class="stop_time">2024/10/11 08:30</div>
    `)
  })
})
