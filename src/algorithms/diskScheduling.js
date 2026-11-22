export const ALGORITHMS = ['FCFS', 'SSTF', 'SCAN', 'C-SCAN', 'LOOK', 'C-LOOK']

export function validateInput({ diskSize, initialHead, requests, seekTime }) {
  const errors = {}
  if (!Number.isInteger(diskSize) || diskSize <= 0) {
    errors.diskSize = 'Disk size must be a positive whole number.'
  }
  if (!Number.isInteger(initialHead) || initialHead < 0) {
    errors.initialHead = 'Initial head position must be a non-negative whole number.'
  } else if (Number.isInteger(diskSize) && diskSize > 0 && initialHead >= diskSize) {
    errors.initialHead = `Initial head must be between 0 and ${diskSize - 1}.`
  }
  if (!Array.isArray(requests) || requests.length === 0) {
    errors.requests = 'Enter at least one cylinder request.'
  } else {
    if (requests.some((value) => !Number.isInteger(value))) {
      errors.requests = 'Requests must contain whole numbers separated by commas.'
    } else if (diskSize > 0 && requests.some((value) => value < 0 || value >= diskSize)) {
      errors.requests = `Every request must be between 0 and ${diskSize - 1}.`
    }
  }
  if (!Number.isFinite(seekTime) || seekTime <= 0) {
    errors.seekTime = 'Seek time must be greater than 0 milliseconds.'
  }
  return errors
}

function normalizeRequestItems(queue) {
  return queue.map((cylinder, index) => ({ cylinder, index }))
}

function createResult(initialHead, diskSize, seekTime, queue, serviced, waypoints) {
  const withInitial = [
    { step: 0, cylinder: initialHead, distance: 0, type: 'initial', requestIndex: null },
    ...waypoints.map((point, index) => ({ ...point, step: index + 1 })),
  ]
  const totalHeadMovement = withInitial.slice(1).reduce((sum, point) => sum + point.distance, 0)
  const requestCount = queue.length
  const averageSeekDistance = requestCount ? totalHeadMovement / requestCount : 0
  const averageSeekTime = averageSeekDistance * seekTime
  return {
    diskSize,
    initialHead,
    seekTimePerCylinder: seekTime,
    requestCount,
    traversalWaypoints: withInitial,
    servicedRequestOrder: serviced.map((request) => request.cylinder),
    servicedRequestIndices: serviced.map((request) => request.index),
    movementBreakdown: withInitial.slice(1),
    totalHeadMovement,
    averageSeekDistance,
    averageSeekTime,
  }
}

function appendMovement(waypoints, from, to, type, requestIndex = null) {
  waypoints.push({
    cylinder: to,
    distance: Math.abs(to - from),
    type,
    requestIndex,
  })
  return to
}

function serviceItems(items, initialFrom, waypoints, order) {
  let from = initialFrom
  for (const item of items) {
    from = appendMovement(waypoints, from, item.cylinder, 'request', item.index)
    order.push(item)
  }
  return from
}

export function fcfs({ initialHead, requests, seekTime, diskSize }) {
  const items = normalizeRequestItems(requests)
  const waypoints = []
  const order = []
  serviceItems(items, initialHead, waypoints, order)
  return createResult(initialHead, diskSize, seekTime, requests, order, waypoints)
}

export function sstf({ initialHead, requests, seekTime, diskSize }) {
  const pending = normalizeRequestItems(requests)
  const waypoints = []
  const order = []
  let from = initialHead
  while (pending.length) {
    let closestIndex = 0
    for (let i = 1; i < pending.length; i += 1) {
      const closest = pending[closestIndex]
      const candidate = pending[i]
      const closestDistance = Math.abs(closest.cylinder - from)
      const candidateDistance = Math.abs(candidate.cylinder - from)
      if (
        candidateDistance < closestDistance ||
        (candidateDistance === closestDistance &&
          (candidate.cylinder < closest.cylinder ||
            (candidate.cylinder === closest.cylinder && candidate.index < closest.index)))
      ) {
        closestIndex = i
      }
    }
    const [selected] = pending.splice(closestIndex, 1)
    from = appendMovement(waypoints, from, selected.cylinder, 'request', selected.index)
    order.push(selected)
  }
  return createResult(initialHead, diskSize, seekTime, requests, order, waypoints)
}

function splitAroundHead(initialHead, requests) {
  const lower = []
  const higher = []
  const atHead = []
  requests.forEach((item) => {
    if (item.cylinder < initialHead) lower.push(item)
    else if (item.cylinder > initialHead) higher.push(item)
    else atHead.push(item)
  })
  return { lower, higher, atHead }
}

function scan({ initialHead, requests, seekTime, diskSize, direction }) {
  const items = normalizeRequestItems(requests)
  const { lower, higher, atHead } = splitAroundHead(initialHead, items)
  const waypoints = []
  const order = []
  let from = initialHead
  from = serviceItems(atHead, from, waypoints, order)

  if (direction === 'right') {
    higher.sort((a, b) => a.cylinder - b.cylinder || a.index - b.index)
    lower.sort((a, b) => b.cylinder - a.cylinder || a.index - b.index)
    from = serviceItems(higher, from, waypoints, order)
    if (lower.length) {
      if (from !== diskSize - 1) from = appendMovement(waypoints, from, diskSize - 1, 'boundary')
      from = serviceItems(lower, from, waypoints, order)
    }
  } else {
    lower.sort((a, b) => b.cylinder - a.cylinder || a.index - b.index)
    higher.sort((a, b) => a.cylinder - b.cylinder || a.index - b.index)
    from = serviceItems(lower, from, waypoints, order)
    if (higher.length) {
      if (from !== 0) from = appendMovement(waypoints, from, 0, 'boundary')
      from = serviceItems(higher, from, waypoints, order)
    }
  }
  return createResult(initialHead, diskSize, seekTime, requests, order, waypoints)
}

function cScan({ initialHead, requests, seekTime, diskSize, direction }) {
  const items = normalizeRequestItems(requests)
  const { lower, higher, atHead } = splitAroundHead(initialHead, items)
  const waypoints = []
  const order = []
  let from = initialHead
  from = serviceItems(atHead, from, waypoints, order)

  if (direction === 'right') {
    higher.sort((a, b) => a.cylinder - b.cylinder || a.index - b.index)
    lower.sort((a, b) => a.cylinder - b.cylinder || a.index - b.index)
    from = serviceItems(higher, from, waypoints, order)
    if (lower.length) {
      if (from !== diskSize - 1) from = appendMovement(waypoints, from, diskSize - 1, 'boundary')
      from = appendMovement(waypoints, from, 0, 'wrap')
      from = serviceItems(lower, from, waypoints, order)
    }
  } else {
    lower.sort((a, b) => b.cylinder - a.cylinder || a.index - b.index)
    higher.sort((a, b) => b.cylinder - a.cylinder || a.index - b.index)
    from = serviceItems(lower, from, waypoints, order)
    if (higher.length) {
      if (from !== 0) from = appendMovement(waypoints, from, 0, 'boundary')
      from = appendMovement(waypoints, from, diskSize - 1, 'wrap')
      higher.sort((a, b) => b.cylinder - a.cylinder || a.index - b.index)
      from = serviceItems(higher, from, waypoints, order)
    }
  }
  return createResult(initialHead, diskSize, seekTime, requests, order, waypoints)
}

function look({ initialHead, requests, seekTime, diskSize, direction }) {
  const items = normalizeRequestItems(requests)
  const { lower, higher, atHead } = splitAroundHead(initialHead, items)
  const waypoints = []
  const order = []
  let from = initialHead
  from = serviceItems(atHead, from, waypoints, order)
  if (direction === 'right') {
    higher.sort((a, b) => a.cylinder - b.cylinder || a.index - b.index)
    lower.sort((a, b) => b.cylinder - a.cylinder || a.index - b.index)
    from = serviceItems(higher, from, waypoints, order)
    from = serviceItems(lower, from, waypoints, order)
  } else {
    lower.sort((a, b) => b.cylinder - a.cylinder || a.index - b.index)
    higher.sort((a, b) => a.cylinder - b.cylinder || a.index - b.index)
    from = serviceItems(lower, from, waypoints, order)
    from = serviceItems(higher, from, waypoints, order)
  }
  return createResult(initialHead, diskSize, seekTime, requests, order, waypoints)
}

function cLook({ initialHead, requests, seekTime, diskSize, direction }) {
  const items = normalizeRequestItems(requests)
  const { lower, higher, atHead } = splitAroundHead(initialHead, items)
  const waypoints = []
  const order = []
  let from = initialHead
  from = serviceItems(atHead, from, waypoints, order)

  if (direction === 'right') {
    higher.sort((a, b) => a.cylinder - b.cylinder || a.index - b.index)
    lower.sort((a, b) => a.cylinder - b.cylinder || a.index - b.index)
    from = serviceItems(higher, from, waypoints, order)
    if (lower.length) {
      const jumpTarget = lower[0].cylinder
      if (from !== jumpTarget) from = appendMovement(waypoints, from, jumpTarget, 'wrap')
      from = serviceItems(lower, from, waypoints, order)
    }
  } else {
    lower.sort((a, b) => b.cylinder - a.cylinder || a.index - b.index)
    higher.sort((a, b) => b.cylinder - a.cylinder || a.index - b.index)
    from = serviceItems(lower, from, waypoints, order)
    if (higher.length) {
      const jumpTarget = higher[0].cylinder
      if (from !== jumpTarget) from = appendMovement(waypoints, from, jumpTarget, 'wrap')
      higher.sort((a, b) => b.cylinder - a.cylinder || a.index - b.index)
      from = serviceItems(higher, from, waypoints, order)
    }
  }
  return createResult(initialHead, diskSize, seekTime, requests, order, waypoints)
}

export function runAlgorithm(algorithm, input) {
  const normalized = {
    ...input,
    diskSize: Number(input.diskSize),
    initialHead: Number(input.initialHead),
    seekTime: Number(input.seekTime),
  }
  const errors = validateInput(normalized)
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0])
  if (algorithm === 'FCFS') return fcfs(normalized)
  if (algorithm === 'SSTF') return sstf(normalized)
  if (algorithm === 'SCAN') return scan({ ...normalized, direction: input.direction })
  if (algorithm === 'C-SCAN') return cScan({ ...normalized, direction: input.direction })
  if (algorithm === 'LOOK') return look({ ...normalized, direction: input.direction })
  if (algorithm === 'C-LOOK') return cLook({ ...normalized, direction: input.direction })
  throw new Error(`Unknown algorithm: ${algorithm}`)
}
