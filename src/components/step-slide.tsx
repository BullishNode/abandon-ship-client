import { AnimatePresence, m } from 'motion/react'
import type { ReactNode } from 'react'

export const slideVariants = {
  center: {
    opacity: 1,
    x: 0
  },
  enter: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? '100%' : '-100%'
  }),
  exit: {
    opacity: 0,
    transition: { duration: 0.1 }
  }
}

export const slideTransition = {
  opacity: { duration: 0.1 },
  x: { damping: 30, stiffness: 300, type: 'spring' }
} as const

const FORWARD = 1

interface StepSlideProps {
  stepKey: string
  children: ReactNode
}

export function StepSlide({ stepKey, children }: StepSlideProps) {
  return (
    <div className="-mx-1 w-full overflow-x-clip px-1">
      <AnimatePresence custom={FORWARD} initial={false} mode="popLayout">
        <m.div
          animate="center"
          className="flex w-full flex-col"
          custom={FORWARD}
          exit="exit"
          initial="enter"
          key={stepKey}
          transition={slideTransition}
          variants={slideVariants}
        >
          {children}
        </m.div>
      </AnimatePresence>
    </div>
  )
}
