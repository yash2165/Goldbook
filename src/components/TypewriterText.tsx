import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

export function TypewriterText({ text, speed = 30 }: { text: string; speed?: number }) {
  const [displayedText, setDisplayedText] = useState('')
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    let i = 0
    setDisplayedText('')
    setIsComplete(false)
    
    const interval = setInterval(() => {
      setDisplayedText(text.slice(0, i))
      i++
      if (i > text.length) {
        clearInterval(interval)
        setIsComplete(true)
      }
    }, speed)

    return () => clearInterval(interval)
  }, [text, speed])

  return (
    <motion.span
      animate={isComplete ? { textShadow: ['0px 0px 0px rgba(245,159,11,0)', '0px 0px 10px rgba(245,159,11,0.5)', '0px 0px 0px rgba(245,159,11,0)'] } : {}}
      transition={{ duration: 1 }}
    >
      {displayedText}
      {!isComplete && <span className="inline-block w-2 h-4 ml-1 bg-[#F59E0B] animate-pulse" />}
    </motion.span>
  )
}
