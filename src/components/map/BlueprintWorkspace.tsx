import { useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDroppable,
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

export default function BlueprintWorkspace() {
  const blueprintId = useBoothStore((state) => state.blueprintId)
  const addBooth = useBoothStore((state) => state.addBooth)
  const updateBoothPosition = useBoothStore((state) => state.updateBoothPosition)
  const setActiveBooth = useBoothStore((state) => state.setActiveBooth)

  const { setNodeRef, isOver } = useDroppable({ id: 'blueprint-canvas' })
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
      canvasRect.width > 0
    ) {
      const template = data.template

      let clientX: number | null = null
      let clientY: number | null = null

      if ('clientX' in event.activatorEvent) {
        const activator = event.activatorEvent as PointerEvent
        clientX = activator.clientX + event.delta.x
        clientY = activator.clientY + event.delta.y
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

        const positionX = snapToGrid(clamp(pointerX - template.width / 2, 0, CANVAS_WIDTH - template.width))
        const positionY = snapToGrid(
          clamp(pointerY - template.height / 2, 0, CANVAS_HEIGHT - template.height),
        )

        addBooth({
          id: crypto.randomUUID(),
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
        <BlueprintCanvas setNodeRef={setNodeRef} isOver={isOver} svgRef={svgRef} />
      </div>

      <DragOverlay dropAnimation={null}>
        {activePalette ? (
          <div className="pointer-events-none w-44 rounded-[8px] border border-pine-dark bg-pine px-3 py-2.5 text-white shadow-lg">
            <p className="text-sm font-semibold">{activePalette.template.category}</p>
            <p className="text-[11px] text-pine-soft">
              {activePalette.template.width} × {activePalette.template.height} px
            </p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
