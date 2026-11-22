import { describe, expect, it } from 'vitest'
import { ALGORITHMS, runAlgorithm, validateInput } from './diskScheduling'

const standard = {
  diskSize: 200,
  initialHead: 53,
  requests: [98, 183, 37, 122, 14, 124, 65, 67],
  direction: 'right',
  seekTime: 1,
}

const expected = {
  FCFS: 640,
  SSTF: 236,
  SCAN: 331,
  'C-SCAN': 382,
  LOOK: 299,
  'C-LOOK': 322,
}

function sortedMultiset(values) {
  return [...values].sort((a, b) => a - b)
}

describe('disk scheduling algorithms', () => {
  it.each(ALGORITHMS)('%s matches the standard workload', (algorithm) => {
    const result = runAlgorithm(algorithm, standard)
    expect(result.totalHeadMovement).toBe(expected[algorithm])
    expect(sortedMultiset(result.servicedRequestOrder)).toEqual(sortedMultiset(standard.requests))
  })

  it('calculates movement independently from absolute waypoint differences', () => {
    for (const algorithm of ALGORITHMS) {
      const result = runAlgorithm(algorithm, standard)
      const calculated = result.traversalWaypoints.slice(1).reduce((sum, point) => sum + point.distance, 0)
      expect(calculated).toBe(result.totalHeadMovement)
    }
  })

  it('preserves duplicates and requests equal to the initial head', () => {
    const input = { ...standard, requests: [53, 53, 14, 14, 65] }
    for (const algorithm of ALGORITHMS) {
      const result = runAlgorithm(algorithm, input)
      expect(sortedMultiset(result.servicedRequestOrder)).toEqual(sortedMultiset(input.requests))
      expect(result.requestCount).toBe(input.requests.length)
    }
  })

  it('handles a single request', () => {
    const input = { ...standard, requests: [53] }
    for (const algorithm of ALGORITHMS) {
      const result = runAlgorithm(algorithm, input)
      expect(result.totalHeadMovement).toBe(0)
      expect(result.servicedRequestOrder).toEqual([53])
    }
  })

  it('handles boundary requests and avoids an unnecessary boundary move', () => {
    const input = { ...standard, requests: [0, 199] }
    for (const algorithm of ALGORITHMS) {
      const result = runAlgorithm(algorithm, input)
      expect(sortedMultiset(result.servicedRequestOrder)).toEqual([0, 199])
    }
  })

  it('handles all requests on one side', () => {
    for (const algorithm of ALGORITHMS) {
      const result = runAlgorithm(algorithm, { ...standard, requests: [54, 55, 60] })
      expect(sortedMultiset(result.servicedRequestOrder)).toEqual([54, 55, 60])
    }
  })

  it('supports leftward directional algorithms', () => {
    for (const algorithm of ['SCAN', 'C-SCAN', 'LOOK', 'C-LOOK']) {
      const result = runAlgorithm(algorithm, { ...standard, direction: 'left' })
      expect(sortedMultiset(result.servicedRequestOrder)).toEqual(sortedMultiset(standard.requests))
    }
  })

  it('validates malformed and out-of-range input', () => {
    expect(validateInput({ diskSize: 0, initialHead: -1, requests: [], seekTime: 0 }))
      .toHaveProperty('diskSize')
    expect(validateInput({ diskSize: 200, initialHead: 200, requests: [201], seekTime: 1 }))
      .toHaveProperty('initialHead')
    expect(validateInput({ diskSize: 200, initialHead: 53, requests: [12.5], seekTime: 1 }))
      .toHaveProperty('requests')
  })

  it('uses request count for average distance and seek time approximation', () => {
    const result = runAlgorithm('FCFS', standard)
    expect(result.averageSeekDistance).toBe(result.totalHeadMovement / result.requestCount)
    expect(result.averageSeekTime).toBe(result.averageSeekDistance * 1)
  })
})
