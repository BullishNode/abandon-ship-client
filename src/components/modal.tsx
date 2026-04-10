import {
  type ComponentProps,
  type ReactNode,
  type Ref,
  useEffect,
  useRef,
  useState
} from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer'
import { useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'

interface ModalProps {
  children: ReactNode
  showModal?: boolean
  setShowModal?: (open: boolean) => void
  onClose?: () => void
  className?: string
  preventDefaultClose?: boolean
}

function Modal({
  children,
  showModal,
  setShowModal,
  onClose,
  className,
  preventDefaultClose
}: ModalProps) {
  const { isMobile } = useMediaQuery()

  const handleClose = ({ dragged }: { dragged?: boolean } = {}) => {
    if (preventDefaultClose && !dragged) {
      return
    }
    onClose?.()
    setShowModal?.(false)
  }

  if (isMobile) {
    return (
      <Drawer
        onOpenChange={(open) => {
          if (!open) {
            handleClose({ dragged: true })
          }
        }}
        open={showModal}
      >
        <DrawerContent className={className}>{children}</DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          handleClose()
        }
      }}
      open={showModal}
    >
      <DialogContent className={className}>{children}</DialogContent>
    </Dialog>
  )
}

function ModalHeader({
  className,
  ...props
}: ComponentProps<typeof DialogHeader>) {
  const { isMobile } = useMediaQuery()

  if (isMobile) {
    return <DrawerHeader className={className} {...props} />
  }

  return <DialogHeader className={className} {...props} />
}

function ModalBody({
  className,
  children,
  ref,
  ...props
}: ComponentProps<'div'> & { ref?: Ref<HTMLDivElement> }) {
  const innerRef = useRef<HTMLDivElement>(null)
  const [canScrollUp, setCanScrollUp] = useState(false)
  const [canScrollDown, setCanScrollDown] = useState(false)

  const updateScrollState = () => {
    const el = innerRef.current
    if (!el) {
      return
    }
    setCanScrollUp(el.scrollTop > 0)
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 1)
  }

  useEffect(() => {
    const el = innerRef.current
    if (!el) {
      return
    }

    updateScrollState()
    const observer = new ResizeObserver(updateScrollState)
    observer.observe(el)
    for (const child of el.children) {
      observer.observe(child)
    }

    return () => observer.disconnect()
  })

  const setRefs = (node: HTMLDivElement | null) => {
    innerRef.current = node
    if (typeof ref === 'function') {
      ref(node)
    } else if (ref) {
      ref.current = node
    }
  }

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      data-slot="modal-body"
    >
      {canScrollUp && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-linear-to-b from-background to-transparent" />
      )}
      <div
        className={cn(
          '-mx-1 min-h-0 flex-auto px-1',
          canScrollUp || canScrollDown
            ? 'overflow-y-auto'
            : 'overflow-y-hidden',
          className
        )}
        onScroll={updateScrollState}
        ref={setRefs}
        {...props}
      >
        {children}
      </div>
      {canScrollDown && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-6 bg-linear-to-t from-background to-transparent" />
      )}
    </div>
  )
}

function ModalFooter({
  className,
  ...props
}: ComponentProps<typeof DialogFooter>) {
  const { isMobile } = useMediaQuery()

  if (isMobile) {
    return <DrawerFooter className={className} {...props} />
  }

  return <DialogFooter className={className} {...props} />
}

function ModalTitle({
  className,
  ...props
}: ComponentProps<typeof DialogTitle>) {
  const { isMobile } = useMediaQuery()

  if (isMobile) {
    return <DrawerTitle className={className} {...props} />
  }

  return <DialogTitle className={className} {...props} />
}

function ModalDescription({
  className,
  ...props
}: ComponentProps<typeof DialogDescription>) {
  const { isMobile } = useMediaQuery()

  if (isMobile) {
    return <DrawerDescription className={className} {...props} />
  }

  return <DialogDescription className={className} {...props} />
}

export {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalTitle,
  ModalDescription
}
