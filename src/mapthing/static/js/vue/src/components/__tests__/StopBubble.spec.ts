import { describe, it, expect } from 'vitest'

import { mount } from '@vue/test-utils'
import xmlFormat from 'xml-formatter'
import { promisify } from 'util'

import StopBubble from '../StopBubble.vue'
import Stop from '@/models/Stop'
import Locations from '@/fixtures/Location'

const clean = (html) => {
  const out = xmlFormat(`<root>${html}</root>`, { collapseContent: true, indentation: '  ' })
  return out.split('\n').slice(1,-1).join('\n').replaceAll(/^  /mg,'');
}

describe('StopBubble', () => {
  it('renders properly', () => {
    const wrapper = mount(StopBubble, { props: {
      stop: {
          start_time: '2024-10-10 20:00:00',
          end_time: '2024-10-11 08:30:00',
          location: Locations.Home,
      }
    } })
    expect(clean(wrapper.html())).toMatchSnapshot()
  })
})
