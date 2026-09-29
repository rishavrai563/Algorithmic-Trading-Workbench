import { useEffect, useRef } from 'react'
import { createChart } from 'lightweight-charts'

export default function CandlestickChart({ data, trades, onTradeClick, height = 400 }) {
  const chartContainerRef = useRef()
  const chartRef = useRef()

  useEffect(() => {
    if (!chartContainerRef.current) return

    // Create Chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor: '#64748b',
      },
      grid: {
        vertLines: { color: '#e2e8f0' },
        horzLines: { color: '#e2e8f0' },
      },
      width: chartContainerRef.current.clientWidth,
      height: height,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#cbd5e1',
      },
    })
    
    chartRef.current = chart

    // Add Candlestick Series
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })

    // Remove duplicates from data and sort
    const uniqueData = data
      .filter((v, i, a) => a.findIndex(t => t.time === v.time) === i)
      .sort((a, b) => a.time - b.time)

    candleSeries.setData(uniqueData)

    // Add Trade Markers
    let markers = []
    if (trades && trades.length > 0) {
      markers = trades.map(trade => {
        const isBuy = trade.direction === 'Buy'
        const time = Math.floor(new Date(trade.time).getTime() / 1000)
        
        return {
          time: time,
          position: isBuy ? 'belowBar' : 'aboveBar',
          color: isBuy ? '#22c55e' : '#ef4444', // Green for BUY, Red for SELL
          shape: isBuy ? 'arrowUp' : 'arrowDown',
          text: `${isBuy ? 'BUY' : 'SELL'}`,
          size: 2,
          trade: trade // Attach original trade for click handling
        }
      })
      
      markers.sort((a, b) => a.time - b.time)
      
      try {
        candleSeries.setMarkers(markers)
      } catch (e) {
        console.warn("Could not set all markers, some times may be outside data range or duplicated:", e)
      }
    }

    // Handle clicks for trade markers
    if (onTradeClick) {
      chart.subscribeClick((param) => {
        if (!param.point || !param.time) return
        
        // Find if a marker exists at this time
        const clickedMarker = markers.find(m => m.time === param.time)
        if (clickedMarker && clickedMarker.trade) {
          onTradeClick(clickedMarker.trade)
        } else {
          onTradeClick(null) // clear selection if clicked elsewhere
        }
      })
    }

    // Handle resize
    const handleResize = () => {
      chart.applyOptions({ width: chartContainerRef.current.clientWidth })
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [data, trades, height, onTradeClick])

  return (
    <div 
      ref={chartContainerRef} 
      style={{ width: '100%', height: `${height}px`, borderRadius: '8px', overflow: 'hidden' }} 
    />
  )
}
