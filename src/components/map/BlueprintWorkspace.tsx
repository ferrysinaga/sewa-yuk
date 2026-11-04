import { useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent, DragMoveEvent, DragStartEvent } from '@dnd-kit/core'
import BlueprintCanvas from './BlueprintCanvas'
import BoothSidebar from './BoothSidebar'
import { useBoothStore } from '../../store/useBoothStore'
import type { BoothTemplate } from '../../types/booth'

const CANVAS_WIDTH = 1000
const CANVAS_HEIGHT = 640
const GRID_SIZE = 20

interface PaletteDragData {
  type: 'palette'
  template: BoothTemplate
}

interface BoothDragData {
  type: 'booth'
  boothId: string
}

type DragData = PaletteDragData | BoothDragData

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function snapToGrid(value: number) {
  return Math.round(value / GRID_SIZE) * GRID_SIZE
}

function createBoothId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  // crypto.randomUUID hanya tersedia pada secure context (HTTPS/localhost).
  // Fallback ini menjaga penambahan booth tetap bekerja saat editor dibuka
  // lewat HTTP biasa (misalnya dari IP jaringan lokal).
  const bytes = new Uint8Array(16)

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256)
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-')
}

function getActivatorPoint(activatorEvent: Event): { x: number; y: number } | null {
  const pointerLike = activatorEvent as PointerEvent

  if (
    typeof pointerLike.clientX === 'number' &&
    typeof pointerLike.clientY === 'number'
  ) {
    return { x: pointerLike.clientX, y: pointerLike.clientY }
  }

  const touchEvent = activatorEvent as TouchEvent
  const touch = touchEvent.changedTouches?.[0] ?? touchEvent.touches?.[0]

  if (touch) {
    return { x: touch.clientX, y: touch.clientY }
  }

  return null
}

export default function BlueprintWorkspace() {
  const blueprintId = useBoothStore((state) => state.blueprintId)
  const addBooth = useBoothStore((state) => state.addBooth)
  const updateBoothPosition = useBoothStore((state) => state.updateBoothPosition)
  const setActiveBooth = useBoothStore((state) => state.setActiveBooth)

  const svgRef = useRef<SVGSVGElement>(null)
  const dragStartRef = useRef<{ boothId: string; x: number; y: number } | null>(null)
  const [activePalette, setActivePalette] = useState<PaletteDragData | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  )

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as DragData | undefined

    if (data?.type === 'palette') {
      setActivePalette(data)
      return
    }

    if (data?.type === 'booth') {
      const booth = useBoothStore.getState().booths.find((item) => item.id === data.boothId)
      if (booth) {
        dragStartRef.current = { boothId: booth.id, x: booth.positionX, y: booth.positionY }
      }
    }
  }

  const handleDragMove = (event: DragMoveEvent) => {
    const data = event.active.data.current as DragData | undefined
    const start = dragStartRef.current

    if (data?.type !== 'booth' || !start || event.over?.id !== 'blueprint-canvas') return

    const canvasRect = svgRef.current?.getBoundingClientRect()
    if (!canvasRect || canvasRect.width === 0 || canvasRect.height === 0) return

    const booth = useBoothStore.getState().booths.find((item) => item.id === start.boothId)
    if (!booth) return

    const nextX = snapToGrid(
      clamp(start.x + (event.delta.x / canvasRect.width) * CANVAS_WIDTH, 0, CANVAS_WIDTH - booth.width),
    )
    const nextY = snapToGrid(
      clamp(start.y + (event.delta.y / canvasRect.height) * CANVAS_HEIGHT, 0, CANVAS_HEIGHT - booth.height),
    )

    if (nextX !== booth.positionX || nextY !== booth.positionY) {
      updateBoothPosition(booth.id, nextX, nextY)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const data = event.active.data.current as DragData | undefined
    const canvasRect = svgRef.current?.getBoundingClientRect()

    if (
      data?.type === 'palette' &&
      event.over?.id === 'blueprint-canvas' &&
      canvasRect &&
      canvasRect.width > 0 &&
      canvasRect.height > 0
    ) {
      const template = data.template
      const activatorPoint = getActivatorPoint(event.activatorEvent)

      let clientX: number | null = null
      let clientY: number | null = null

      if (activatorPoint) {
        clientX = activatorPoint.x + event.delta.x
        clientY = activatorPoint.y + event.delta.y
      } else {
        const translated = event.active.rect.current.translated
        if (translated) {
          clientX = translated.left + translated.width / 2
          clientY = translated.top + translated.height / 2
        }
      }

      if (clientX !== null && clientY !== null) {
        const pointerX = ((clientX - canvasRect.left) / canvasRect.width) * CANVAS_WIDTH
        const pointerY = ((clientY - canvasRect.top) / canvasRect.height) * CANVAS_HEIGHT

        const positionX = clamp(
          snapToGrid(pointerX - template.width / 2),
          0,
          CANVAS_WIDTH - template.width,
        )
        const positionY = clamp(
          snapToGrid(pointerY - template.height / 2),
          0,
          CANVAS_HEIGHT - template.height,
        )

        addBooth({
          id: createBoothId(),
          blueprintId,
          category: template.category,
          positionX,
          positionY,
          width: template.width,
          height: template.height,
          price: template.price,
          status: 'Available',
        })
      }
    }

    if (data?.type === 'booth') {
      setActiveBooth(data.boothId)
    }

    dragStartRef.current = null
    setActivePalette(null)
  }

  const handleDragCancel = () => {
    const start = dragStartRef.current

    if (start) {
      const booth = useBoothStore.getState().booths.find((item) => item.id === start.boothId)
      if (booth && (booth.positionX !== start.x || booth.positionY !== start.y)) {
        updateBoothPosition(start.boothId, start.x, start.y)
      }
    }

    dragStartRef.current = null
    setActivePalette(null)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex flex-col gap-5 lg:flex-row">
        <BoothSidebar />
        <BlueprintCanvas svgRef={svgRef} />
      </div>

      <DragOverlay dropAnimation={null}>
        {activePalette ? (
          <div className="pointer-events-none w-44 rounded-xl border border-blue-700 bg-blue-600 px-3 py-2.5 text-white shadow-lg">
            <p className="text-sm font-semibold">{activePalette.template.category}</p>
            <p className="text-[11px] text-blue-100">
              {activePalette.template.width} × {activePalette.template.height} px
            </p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
