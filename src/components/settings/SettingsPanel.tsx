'use client';

import React, { useState, useEffect } from 'react';
import { countries } from '@/lib/countries';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TimeRange {
  start: string;
  end: string;
  enabled: boolean;
}

interface MealSchedule {
  breakfast: TimeRange;
  lunch: TimeRange;
  dinner: TimeRange;
}

type PaymentMethod = 'card' | 'apple' | 'google' | 'wechat' | 'alipay';
type SubscriptionPlan = 'free' | 'monthly' | 'annual';

const menuItems = [
  { id: 'clock', label: 'Type of Clock', icon: '🕐' },
  { id: 'language', label: 'Language & City/State', icon: '🌍' },
  { id: 'sleep', label: 'Sleep Schedule', icon: '😴' },
  { id: 'eating', label: 'Eating Schedule', icon: '🍽️' },
  { id: 'download', label: 'Download App', icon: '💻' },
  { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: '⌨️' },
  { id: 'integrate', label: 'Integrate Calendars', icon: '📅' },
  { id: 'import', label: 'Import Calendars', icon: '📥' },
  { id: 'subscription', label: 'Subscription', icon: '💎' },
  { id: 'contact', label: 'Contact Us', icon: '📧' },
];

/** ----------------- Sleep timeline helpers (single source of truth) ----------------- */
const START_HOUR = 20;          // 8 PM baseline
const TOTAL_MIN = 18 * 60;      // 8 PM -> 2 PM next day span = 1080 mins

const toHM = (t: string) => t.split(':').map(Number) as [number, number];
const toMinutes = (t: string) => { const [h, m] = toHM(t); return h * 60 + m; };

// minutes after START_HOUR within [0, 1440)
const minsFromStart = (t: string) => {
  let d = toMinutes(t) - START_HOUR * 60;
  if (d < 0) d += 1440;
  return d;
};

// map time -> percent [0..100] on the 18h band
const timeToPercent = (t: string) => (minsFromStart(t) / TOTAL_MIN) * 100;

// percent -> time string (snap 30 min)
const percentToTime = (p: number) => {
  let mins = Math.round(((p / 100) * TOTAL_MIN) / 30) * 30; // snap to 30
  mins = Math.max(0, Math.min(TOTAL_MIN, mins));            // clamp inside band
  const abs = (START_HOUR * 60 + mins) % 1440;
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

// range clamps for handles: bedtime 8PM→1AM ; wake 5AM→2PM
const clampBed = (p: number) => {
  const minP = 0;                                   // 8 PM
  const maxP = (5 * 60) / TOTAL_MIN * 100;          // +5h = 1 AM
  return Math.max(minP, Math.min(maxP, p));
};
const clampWake = (p: number) => {
  const minP = (9 * 60) / TOTAL_MIN * 100;          // +9h = 5 AM
  const maxP = 100;                                  // 2 PM
  return Math.max(minP, Math.min(maxP, p));
};
/** ------------------------------------------------------------------------------ */

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  const [activeSection, setActiveSection] = useState<string>('clock');
  const [clockType, setClockType] = useState<'12h' | '24h'>('12h');
  const [language, setLanguage] = useState<'en' | 'zh'>('en');
  const [country, setCountry] = useState('New York City');
  const [countrySearch, setCountrySearch] = useState('');
  const [showCountryList, setShowCountryList] = useState(false);

  // sleep state (defaults 22:00 → 08:00)
  const [sleepStart, setSleepStart] = useState('22:00');
  const [sleepEnd, setSleepEnd] = useState('08:00');

  const [isDraggingBedtime, setIsDraggingBedtime] = useState(false);
  const [isDraggingWake, setIsDraggingWake] = useState(false);

  const [mealSchedule, setMealSchedule] = useState<MealSchedule>({
    breakfast: { start: '07:00', end: '08:00', enabled: true },
    lunch: { start: '12:00', end: '13:00', enabled: true },
    dinner: { start: '18:00', end: '19:00', enabled: true },
  });
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('free');
  const [referralCode, setReferralCode] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('card');

  const filteredCountries = countrySearch
    ? countries.filter(c => c.toLowerCase().includes(countrySearch.toLowerCase())).sort()
    : countries.slice().sort();

  const timeToSliderValue = (time: string, min: number, max: number): number => {
    const [hours, minutes] = time.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;
    const minMinutes = min * 60;
    const maxMinutes = max * 60;
    return ((totalMinutes - minMinutes) / (maxMinutes - minMinutes)) * 100;
  };

  const sliderToTime = (value: number, min: number, max: number): string => {
    const minMinutes = min * 60;
    const maxMinutes = max * 60;
    const totalMinutes = Math.round((value / 100) * (maxMinutes - minMinutes) + minMinutes);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const formatTime = (time: string, format: '12h' | '24h'): string => {
    const [hours, minutes] = time.split(':').map(Number);
    if (format === '24h') {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    } else {
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${minutes.toString().padStart(2, '0')}${period}`;
    }
  };

  const calculateDiscountedPrice = (): { monthly: number; annual: number } => {
    const baseMonthly = 6;
    const baseAnnual = 36;
    if (referralCode === 'SAVE30') {
      return { monthly: baseMonthly * 0.7, annual: baseAnnual * 0.7 };
    }
    return { monthly: baseMonthly, annual: baseAnnual };
  };

  const prices = calculateDiscountedPrice();

  // Handle global mouse events for slider dragging (unified mapping)
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDraggingBedtime && !isDraggingWake) return;
      const timeline = document.querySelector('.sleep-timeline') as HTMLElement | null;
      if (!timeline) return;

      const rect = timeline.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      let p = (x / rect.width) * 100;

      if (isDraggingBedtime) {
        p = clampBed(p);
        setSleepStart(percentToTime(p));
      } else if (isDraggingWake) {
        p = clampWake(p);
        setSleepEnd(percentToTime(p));
      }
    };

    const handleGlobalMouseUp = () => {
      setIsDraggingBedtime(false);
      setIsDraggingWake(false);
    };

    if (isDraggingBedtime || isDraggingWake) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isDraggingBedtime, isDraggingWake]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 animate-fadeIn"
        onClick={onClose}
      />

      {/* Settings Popup */}
      <div className="fixed top-1/2 left-1/2 z-50" style={{ transform: 'translate(-50%, -50%)' }}>
        <div className="animate-scaleIn">
          <div className="bg-white rounded-2xl shadow-2xl w-[900px] h-[600px] overflow-hidden flex border border-blue-100">
          {/* Left Sidebar */}
          <div className="w-56 bg-gradient-to-b from-blue-50 to-sky-50 p-3 border-r border-blue-200 overflow-y-auto">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-blue-900">Settings</h2>
              <p className="text-xs text-black mt-0.5">Customize your experience</p>
            </div>
            <nav className="space-y-0.5">
              {menuItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all ${
                    activeSection === item.id
                      ? 'bg-white text-slate-700 shadow-sm'
                      : 'text-blue-700 hover:bg-white/50'
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  <span className="text-xs font-medium">{item.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Right Content Area */}
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-blue-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-blue-900">
                {menuItems.find(item => item.id === activeSection)?.label}
              </h3>
              <button
                onClick={onClose}
                className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeSection === 'clock' && (
                <div className="space-y-4">
                  <p className="text-sm text-black mb-4">Choose how you want time to be displayed throughout the app.</p>
                  <label className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-blue-50 transition-colors">
                    <div>
                      <div className="font-medium text-blue-600">12-hour clock</div>
                      <div className="text-sm text-black mt-1">Examples: 3:20AM, 4:50PM</div>
                    </div>
                    <input
                      type="radio"
                      name="clock"
                      value="12h"
                      checked={clockType === '12h'}
                      onChange={(e) => setClockType(e.target.value as '12h')}
                      className="w-4 h-4 text-slate-600"
                    />
                  </label>
                  <label className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-blue-50 transition-colors">
                    <div>
                      <div className="font-medium text-blue-600">24-hour clock</div>
                      <div className="text-sm text-black mt-1">Examples: 11:30, 16:30</div>
                    </div>
                    <input
                      type="radio"
                      name="clock"
                      value="24h"
                      checked={clockType === '24h'}
                      onChange={(e) => setClockType(e.target.value as '24h')}
                      className="w-4 h-4 text-slate-600"
                    />
                  </label>
                </div>
              )}

              {activeSection === 'language' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-blue-700 mb-2">Language</label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value as 'en' | 'zh')}
                      className="w-full px-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                    >
                      <option value="en">English</option>
                      <option value="zh">中文 (Chinese)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-700 mb-2">City/State of Residence</label>
                    <input
                      type="text"
                      value={countrySearch}
                      onChange={(e) => setCountrySearch(e.target.value)}
                      placeholder={country || "Search cities/states..."}
                      className="w-full px-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black placeholder-black"
                      onFocus={() => {
                        setShowCountryList(true);
                        setCountrySearch('');
                      }}
                      onBlur={() => {
                        setTimeout(() => setShowCountryList(false), 200);
                      }}
                    />
                    {showCountryList && (
                      <div className="max-h-48 overflow-y-auto border border-blue-200 rounded-lg mt-2">
                        {filteredCountries.map(c => (
                          <button
                            key={c}
                            onClick={() => {
                              setCountry(c);
                              setCountrySearch('');
                              setShowCountryList(false);
                            }}
                            className={`w-full px-4 py-2 text-left hover:bg-blue-50 transition-colors text-black ${
                              country === c ? 'bg-blue-100 font-semibold' : ''
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeSection === 'sleep' && (
                <div className="space-y-4">
                  <p className="text-sm text-black mb-4">Set your typical sleep schedule to optimize task planning.</p>

                  <div>
                    {/* Manual Inputs */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-xs font-medium text-black mb-1">Bedtime</label>
                        <select
                          value={sleepStart}
                          onChange={(e) => setSleepStart(e.target.value)}
                          className="w-full px-3 py-2 border border-blue-300 rounded-lg text-black focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="20:00">8:00 PM</option>
                          <option value="20:30">8:30 PM</option>
                          <option value="21:00">9:00 PM</option>
                          <option value="21:30">9:30 PM</option>
                          <option value="22:00">10:00 PM</option>
                          <option value="22:30">10:30 PM</option>
                          <option value="23:00">11:00 PM</option>
                          <option value="23:30">11:30 PM</option>
                          <option value="00:00">12:00 AM</option>
                          <option value="00:30">12:30 AM</option>
                          <option value="01:00">1:00 AM</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-black mb-1">Wake Time</label>
                        <select
                          value={sleepEnd}
                          onChange={(e) => setSleepEnd(e.target.value)}
                          className="w-full px-3 py-2 border border-blue-300 rounded-lg text-black focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="05:00">5:00 AM</option>
                          <option value="05:30">5:30 AM</option>
                          <option value="06:00">6:00 AM</option>
                          <option value="06:30">6:30 AM</option>
                          <option value="07:00">7:00 AM</option>
                          <option value="07:30">7:30 AM</option>
                          <option value="08:00">8:00 AM</option>
                          <option value="08:30">8:30 AM</option>
                          <option value="09:00">9:00 AM</option>
                          <option value="09:30">9:30 AM</option>
                          <option value="10:00">10:00 AM</option>
                          <option value="10:30">10:30 AM</option>
                          <option value="11:00">11:00 AM</option>
                          <option value="11:30">11:30 AM</option>
                          <option value="12:00">12:00 PM</option>
                          <option value="12:30">12:30 PM</option>
                          <option value="13:00">1:00 PM</option>
                          <option value="13:30">1:30 PM</option>
                          <option value="14:00">2:00 PM</option>
                        </select>
                      </div>
                    </div>

                    {/* Visual Timeline */}
                    <div className="text-xs font-medium text-black mb-2">Visual Timeline</div>
                    <div
                      className="sleep-timeline relative h-16 bg-gradient-to-r from-indigo-100 via-purple-100 via-blue-100 to-yellow-100 rounded-lg p-3 cursor-pointer select-none"
                      onMouseMove={(e) => {
                        if (!isDraggingBedtime && !isDraggingWake) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
                        let p = (x / rect.width) * 100;
                        if (isDraggingBedtime) {
                          p = clampBed(p);
                          setSleepStart(percentToTime(p));
                        } else if (isDraggingWake) {
                          p = clampWake(p);
                          setSleepEnd(percentToTime(p));
                        }
                      }}
                      onMouseUp={() => {
                        setIsDraggingBedtime(false);
                        setIsDraggingWake(false);
                      }}
                      onMouseLeave={() => {
                        setIsDraggingBedtime(false);
                        setIsDraggingWake(false);
                      }}
                    >
                      {/* Sleep period visual bar */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 h-2 bg-indigo-400 opacity-40 rounded pointer-events-none"
                        style={{
                          left: `${timeToPercent(sleepStart)}%`,
                          width: `${(() => {
                            let w = minsFromStart(sleepEnd) - minsFromStart(sleepStart);
                            if (w < 0) w += 1440;            // wrap midnight
                            w = Math.min(w, TOTAL_MIN);      // cap to 18h band
                            return (w / TOTAL_MIN) * 100;
                          })()}%`
                        }}
                      />

                      {/* Bedtime marker */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 bg-indigo-600 rounded-full shadow-lg cursor-grab active:cursor-grabbing z-10"
                        style={{ left: `${timeToPercent(sleepStart)}%` }}
                        title="Bedtime"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsDraggingBedtime(true);
                        }}
                      >
                        <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-medium whitespace-nowrap pointer-events-none">🌙</span>
                      </div>

                      {/* Wake time marker */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 bg-yellow-500 rounded-full shadow-lg cursor-grab active:cursor-grabbing z-10"
                        style={{ left: `${timeToPercent(sleepEnd)}%` }}
                        title="Wake time"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsDraggingWake(true);
                        }}
                      >
                        <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-medium whitespace-nowrap pointer-events-none">☀️</span>
                      </div>

                      {/* Time labels */}
                      <div className="absolute inset-x-0 -bottom-5 flex justify-between px-1 text-[10px]">
                        <span className="text-black">8PM</span>
                        <span className="text-black">10PM</span>
                        <span className="text-black">12AM</span>
                        <span className="text-black">2AM</span>
                        <span className="text-black">4AM</span>
                        <span className="text-black">6AM</span>
                        <span className="text-black">8AM</span>
                        <span className="text-black">10AM</span>
                        <span className="text-black">12PM</span>
                        <span className="text-black">2PM</span>
                      </div>
                    </div>

                    {/* Sleep Duration */}
                    <div className="mt-8 p-3 bg-blue-50 rounded-lg text-center">
                      <span className="text-sm text-black font-medium">
                        Sleep Duration: {(() => {
                          const start = toMinutes(sleepStart);
                          const end = toMinutes(sleepEnd);
                          const duration = end < start ? (1440 - start + end) : (end - start);
                          const hours = Math.floor(duration / 60);
                          const minutes = duration % 60;
                          return `${hours}h ${minutes}m`;
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'eating' && (
                <div className="space-y-6">
                  <p className="text-sm text-black mb-4">Set your meal times to avoid scheduling conflicts.</p>

                  {/* Breakfast */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Breakfast</span>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={mealSchedule.breakfast.enabled}
                          onChange={(e) => setMealSchedule({
                            ...mealSchedule,
                            breakfast: { ...mealSchedule.breakfast, enabled: e.target.checked }
                          })}
                          className="rounded text-slate-600"
                        />
                        Enable
                      </label>
                    </div>
                    {mealSchedule.breakfast.enabled && (
                      <div>
                        <div className="flex justify-between text-sm text-black mb-2">
                          <span>{formatTime(mealSchedule.breakfast.start, clockType)}</span>
                          <span>{formatTime(mealSchedule.breakfast.end, clockType)}</span>
                        </div>
                        <div className="relative h-10 bg-orange-100 rounded-lg p-2">
                          <div
                            className="absolute top-1/2 -translate-y-1/2 h-1 bg-orange-400 rounded"
                            style={{
                              left: `${timeToSliderValue(mealSchedule.breakfast.start, 4, 11)}%`,
                              width: `${timeToSliderValue(mealSchedule.breakfast.end, 4, 11) - timeToSliderValue(mealSchedule.breakfast.start, 4, 11)}%`
                            }}
                          />
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={timeToSliderValue(mealSchedule.breakfast.start, 4, 11)}
                            onChange={(e) => setMealSchedule({
                              ...mealSchedule,
                              breakfast: { ...mealSchedule.breakfast, start: sliderToTime(Number(e.target.value), 4, 11) }
                            })}
                            className="absolute inset-0 w-full opacity-0 cursor-pointer"
                          />
                          <div
                            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-orange-500 rounded-full"
                            style={{ left: `${timeToSliderValue(mealSchedule.breakfast.start, 4, 11)}%` }}
                          />
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={timeToSliderValue(mealSchedule.breakfast.end, 4, 11)}
                            onChange={(e) => setMealSchedule({
                              ...mealSchedule,
                              breakfast: { ...mealSchedule.breakfast, end: sliderToTime(Number(e.target.value), 4, 11) }
                            })}
                            className="absolute inset-0 w-full opacity-0 cursor-pointer"
                          />
                          <div
                            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-orange-500 rounded-full"
                            style={{ left: `${timeToSliderValue(mealSchedule.breakfast.end, 4, 11)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Lunch */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Lunch</span>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={mealSchedule.lunch.enabled}
                          onChange={(e) => setMealSchedule({
                            ...mealSchedule,
                            lunch: { ...mealSchedule.lunch, enabled: e.target.checked }
                          })}
                          className="rounded text-slate-600"
                        />
                        Enable
                      </label>
                    </div>
                    {mealSchedule.lunch.enabled && (
                      <div>
                        <div className="flex justify-between text-sm text-black mb-2">
                          <span>{formatTime(mealSchedule.lunch.start, clockType)}</span>
                          <span>{formatTime(mealSchedule.lunch.end, clockType)}</span>
                        </div>
                        <div className="relative h-10 bg-green-100 rounded-lg p-2">
                          <div
                            className="absolute top-1/2 -translate-y-1/2 h-1 bg-green-400 rounded"
                            style={{
                              left: `${timeToSliderValue(mealSchedule.lunch.start, 10, 16)}%`,
                              width: `${timeToSliderValue(mealSchedule.lunch.end, 10, 16) - timeToSliderValue(mealSchedule.lunch.start, 10, 16)}%`
                            }}
                          />
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={timeToSliderValue(mealSchedule.lunch.start, 10, 16)}
                            onChange={(e) => setMealSchedule({
                              ...mealSchedule,
                              lunch: { ...mealSchedule.lunch, start: sliderToTime(Number(e.target.value), 10, 16) }
                            })}
                            className="absolute inset-0 w-full opacity-0 cursor-pointer"
                          />
                          <div
                            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-green-500 rounded-full"
                            style={{ left: `${timeToSliderValue(mealSchedule.lunch.start, 10, 16)}%` }}
                          />
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={timeToSliderValue(mealSchedule.lunch.end, 10, 16)}
                            onChange={(e) => setMealSchedule({
                              ...mealSchedule,
                              lunch: { ...mealSchedule.lunch, end: sliderToTime(Number(e.target.value), 10, 16) }
                            })}
                            className="absolute inset-0 w-full opacity-0 cursor-pointer"
                          />
                          <div
                            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-green-500 rounded-full"
                            style={{ left: `${timeToSliderValue(mealSchedule.lunch.end, 10, 16)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Dinner */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Dinner</span>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={mealSchedule.dinner.enabled}
                          onChange={(e) => setMealSchedule({
                            ...mealSchedule,
                            dinner: { ...mealSchedule.dinner, enabled: e.target.checked }
                          })}
                          className="rounded text-slate-600"
                        />
                        Enable
                      </label>
                    </div>
                    {mealSchedule.dinner.enabled && (
                      <div>
                        <div className="flex justify-between text-sm text-black mb-2">
                          <span>{formatTime(mealSchedule.dinner.start, clockType)}</span>
                          <span>{formatTime(mealSchedule.dinner.end, clockType)}</span>
                        </div>
                        <div className="relative h-10 bg-blue-100 rounded-lg p-2">
                          <div
                            className="absolute top-1/2 -translate-y-1/2 h-1 bg-blue-400 rounded"
                            style={{
                              left: `${timeToSliderValue(mealSchedule.dinner.start, 15, 24)}%`,
                              width: `${timeToSliderValue(mealSchedule.dinner.end, 15, 24) - timeToSliderValue(mealSchedule.dinner.start, 15, 24)}%`
                            }}
                          />
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={timeToSliderValue(mealSchedule.dinner.start, 15, 24)}
                            onChange={(e) => setMealSchedule({
                              ...mealSchedule,
                              dinner: { ...mealSchedule.dinner, start: sliderToTime(Number(e.target.value), 15, 24) }
                            })}
                            className="absolute inset-0 w-full opacity-0 cursor-pointer"
                          />
                          <div
                            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 rounded-full"
                            style={{ left: `${timeToSliderValue(mealSchedule.dinner.start, 15, 24)}%` }}
                          />
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={timeToSliderValue(mealSchedule.dinner.end, 15, 24)}
                            onChange={(e) => setMealSchedule({
                              ...mealSchedule,
                              dinner: { ...mealSchedule.dinner, end: sliderToTime(Number(e.target.value), 15, 24) }
                            })}
                            className="absolute inset-0 w-full opacity-0 cursor-pointer"
                          />
                          <div
                            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 rounded-full"
                            style={{ left: `${timeToSliderValue(mealSchedule.dinner.end, 15, 24)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeSection === 'download' && (
                <div className="space-y-4">
                  <p className="text-sm text-black mb-4">Download Chronos for your desktop to stay productive everywhere.</p>
                  <button className="w-full p-4 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                      </svg>
                      <div className="text-left">
                        <div className="font-medium">Mac Desktop App</div>
                        <div className="text-sm text-black">Coming this fall</div>
                      </div>
                    </div>
                    <span className="text-sm text-black">Download .dmg</span>
                  </button>
                </div>
              )}

              {activeSection === 'shortcuts' && (
                <div className="space-y-4">
                  <p className="text-sm text-black mb-4">Master these keyboard shortcuts to work faster.</p>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-blue-700 text-sm">Calendar Controls</h4>
                    {[
                      { action: 'Copy Event', shortcut: '⌘ + C' },
                      { action: 'Cut Event', shortcut: '⌘ + X' },
                      { action: 'Paste Event', shortcut: '⌘ + V' },
                      { action: 'Duplicate Event', shortcut: '⌘ + D' },
                      { action: 'Delete Event', shortcut: 'Delete' },
                      { action: 'Undo', shortcut: '⌘ + Z' },
                      { action: 'Redo', shortcut: '⌘ + Y' },
                      { action: 'Search', shortcut: '⌘ + F' },
                    ].map(shortcut => (
                      <div key={shortcut.action} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                        <span className="font-medium text-sm">{shortcut.action}</span>
                        <kbd className="px-3 py-1 bg-white border border-blue-300 rounded text-sm font-mono">
                          {shortcut.shortcut}
                        </kbd>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-blue-700 text-sm">Panel Controls</h4>
                    {[
                      { action: 'Toggle Left Panel (Todo)', shortcut: '← + ←' },
                      { action: 'Toggle Right Panel (Chat/Editor)', shortcut: '→ + →' },
                    ].map(shortcut => (
                      <div key={shortcut.action} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                        <span className="font-medium text-sm">{shortcut.action}</span>
                        <kbd className="px-3 py-1 bg-white border border-blue-300 rounded text-sm font-mono">
                          {shortcut.shortcut}
                        </kbd>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-blue-700 text-sm">Navigation</h4>
                    {[
                      { action: 'Select Previous Day Event', shortcut: '←' },
                      { action: 'Select Next Day Event', shortcut: '→' },
                      { action: 'Select Earlier Event', shortcut: '↑' },
                      { action: 'Select Later Event', shortcut: '↓' },
                    ].map(shortcut => (
                      <div key={shortcut.action} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                        <span className="font-medium text-sm">{shortcut.action}</span>
                        <kbd className="px-3 py-1 bg-white border border-blue-300 rounded text-sm font-mono">
                          {shortcut.shortcut}
                        </kbd>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-blue-700 text-sm">Event Editor</h4>
                    {[
                      { action: 'Save Description', shortcut: '⌘ + Enter' },
                      { action: 'Cancel Editing', shortcut: 'Escape' },
                    ].map(shortcut => (
                      <div key={shortcut.action} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                        <span className="font-medium text-sm">{shortcut.action}</span>
                        <kbd className="px-3 py-1 bg-white border border-blue-300 rounded text-sm font-mono">
                          {shortcut.shortcut}
                        </kbd>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-blue-700 text-sm">Text Formatting (When Editing)</h4>
                    {[
                      { action: 'Bold', shortcut: '⌘ + B' },
                      { action: 'Italic', shortcut: '⌘ + I' },
                      { action: 'Underline', shortcut: '⌘ + U' },
                    ].map(shortcut => (
                      <div key={shortcut.action} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                        <span className="font-medium text-sm">{shortcut.action}</span>
                        <kbd className="px-3 py-1 bg-white border border-blue-300 rounded text-sm font-mono">
                          {shortcut.shortcut}
                        </kbd>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-blue-700 text-sm">Panels</h4>
                    {[
                      { action: 'Hide/Show Left Panel', shortcut: '⌘ + <' },
                      { action: 'Hide/Show Right Panel', shortcut: '⌘ + >' },
                    ].map(shortcut => (
                      <div key={shortcut.action} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                        <span className="font-medium text-sm">{shortcut.action}</span>
                        <kbd className="px-3 py-1 bg-white border border-blue-300 rounded text-sm font-mono">
                          {shortcut.shortcut}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeSection === 'integrate' && (
                <div className="space-y-4">
                  <p className="text-sm text-black mb-4">Connect your existing calendars for seamless scheduling.</p>
                  <button className="w-full p-4 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-3">
                    <svg className="w-6 h-6 text-black" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M22.46 6c-.85.38-1.75.66-2.7.78 1-.6 1.76-1.55 2.12-2.68-.93.55-1.96.95-3.06 1.17-.88-.94-2.13-1.53-3.51-1.53-2.66 0-4.81 2.16-4.81 4.81 0 .38.04.75.13 1.1-4-.2-7.54-2.11-9.91-5.02-.41.7-.65 1.52-.65 2.4 0 1.67.85 3.14 2.14 4.01-.79-.03-1.54-.24-2.19-.6v.06c0 2.33 1.66 4.28 3.86 4.72-.4.1-.83.16-1.27.16-.31 0-.62-.03-.92-.08.63 1.91 2.39 3.3 4.5 3.34-1.65 1.29-3.73 2.06-5.99 2.06-.39 0-.77-.02-1.15-.07 2.13 1.37 4.66 2.16 7.38 2.16 8.86 0 13.71-7.34 13.71-13.71 0-.21 0-.41-.01-.62.94-.68 1.76-1.53 2.41-2.5z"/>
                    </svg>
                    <div className="text-left">
                      <div className="font-medium">Google Calendar</div>
                      <div className="text-sm text-black">Sync events with Google Calendar</div>
                    </div>
                  </button>

                  <button className="w-full p-4 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-3">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                    </svg>
                    <div className="text-left">
                      <div className="font-medium">Apple Calendar</div>
                      <div className="text-sm text-black">Connect with iCloud Calendar</div>
                    </div>
                  </button>

                  <button className="w-full p-4 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-3">
                    <svg className="w-6 h-6 text-black" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81z"/>
                    </svg>
                    <div className="text-left">
                      <div className="font-medium">Outlook Calendar</div>
                      <div className="text-sm text-black">Sync with Microsoft Outlook</div>
                    </div>
                  </button>
                </div>
              )}

              {activeSection === 'import' && (
                <div className="space-y-4">
                  <p className="text-sm text-black mb-4">Import calendar files to add events in bulk.</p>
                  <div className="p-6 border-2 border-dashed border-blue-300 rounded-lg text-center">
                    <svg className="w-12 h-12 text-black mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-black mb-2">Import school calendars and more</p>
                    <p className="text-sm text-black mb-4">Supports .ics files</p>
                    <button className="px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors">
                      Choose File
                    </button>
                  </div>
                </div>
              )}

              {activeSection === 'subscription' && (
                <div className="space-y-6">
                  {/* Free Trial Banner */}
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="font-medium text-green-800 text-sm">30-Day Free Trial Available!</span>
                    </div>
                  </div>

                  {/* Referral Code */}
                  <div>
                    <label className="block text-sm font-medium text-blue-700 mb-2">Have a referral code?</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={referralCode}
                        onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                        placeholder="Enter code (e.g., SAVE30)"
                        className="flex-1 px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                      {referralCode === 'SAVE30' && (
                        <div className="flex items-center gap-1 text-green-600">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-xs font-medium">30% OFF!</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Plans */}
                  <div className="space-y-3">
                    <div className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedPlan === 'free' ? 'border-blue-500 bg-blue-50' : 'border-blue-200 hover:border-blue-300'
                    }`} onClick={() => setSelectedPlan('free')}>
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold">Free</h4>
                          <p className="text-xs text-black">Basic features</p>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold">$0</div>
                        </div>
                      </div>
                    </div>

                    <div className={`p-4 border-2 rounded-lg cursor-pointer transition-all relative ${
                      selectedPlan === 'monthly' ? 'border-blue-500 bg-blue-50' : 'border-blue-200 hover:border-blue-300'
                    }`} onClick={() => setSelectedPlan('monthly')}>
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold">Pro Monthly</h4>
                          <p className="text-xs text-black">Unlimited AI prompts</p>
                        </div>
                        <div className="text-right">
                          {referralCode === 'SAVE30' ? (
                            <>
                              <div className="text-xs text-black line-through">$6.00</div>
                              <div className="text-xl font-bold text-green-600">${prices.monthly.toFixed(2)}</div>
                            </>
                          ) : (
                            <div className="text-xl font-bold">$6.00</div>
                          )}
                          <div className="text-xs text-black">/month</div>
                        </div>
                      </div>
                    </div>

                    <div className={`p-4 border-2 rounded-lg cursor-pointer transition-all relative ${
                      selectedPlan === 'annual' ? 'border-blue-500 bg-blue-50' : 'border-blue-200 hover:border-blue-300'
                    }`} onClick={() => setSelectedPlan('annual')}>
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded-full">
                        SAVE 50%
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold">Pro Annual</h4>
                          <p className="text-xs text-black">Best value</p>
                        </div>
                        <div className="text-right">
                          {referralCode === 'SAVE30' ? (
                            <>
                              <div className="text-xs text-black line-through">$36.00</div>
                              <div className="text-xl font-bold text-green-600">${prices.annual.toFixed(2)}</div>
                            </>
                          ) : (
                            <div className="text-xl font-bold">$36.00</div>
                          )}
                          <div className="text-xs text-black">/year</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {selectedPlan !== 'free' && (
                    <button
                      onClick={() => setShowPayment(true)}
                      className="w-full py-2 bg-gradient-to-r from-slate-700 to-blue-700 text-white font-medium rounded-lg hover:from-slate-800 hover:to-blue-800 transition-all"
                    >
                      Start 30-Day Free Trial
                    </button>
                  )}

                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-black mb-2">Need to cancel?</p>
                    <button className="text-xs text-red-600 hover:underline">
                      Cancel Subscription
                    </button>
                  </div>
                </div>
              )}

              {activeSection === 'contact' && (
                <div className="space-y-4">
                  <p className="text-sm text-black mb-4">We'd love to hear from you!</p>
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-blue-900">Email Us</p>
                        <a href="mailto:Zichen.Zhao@mbzuai.ac.ae" className="text-slate-700 hover:underline text-sm">
                          Zichen.Zhao@mbzuai.ac.ae
                        </a>
                      </div>
                    </div>
                    <p className="text-sm text-black">
                      We are more than happy to see your comments and suggestions on our product.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4">Choose Payment Method</h3>
            <div className="space-y-2">
              {[
                { id: 'card', label: 'Credit/Debit Card', icon: '💳' },
                { id: 'apple', label: 'Apple Pay', icon: '🍎' },
                { id: 'google', label: 'Google Pay', icon: '🇬' },
                { id: 'wechat', label: 'WeChat Pay', icon: '💬' },
                { id: 'alipay', label: 'Alipay', icon: '🔵' },
              ].map(method => (
                <button
                  key={method.id}
                  onClick={() => setSelectedPaymentMethod(method.id as PaymentMethod)}
                  className={`w-full p-3 border rounded-lg flex items-center gap-3 transition-all text-sm ${
                    selectedPaymentMethod === method.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-blue-200 hover:border-blue-300'
                  }`}
                >
                  <span className="text-lg">{method.icon}</span>
                  <span className="font-medium">{method.label}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowPayment(false)}
                className="flex-1 py-2 border border-blue-300 rounded-lg hover:bg-blue-50 text-sm"
              >
                Cancel
              </button>
              <button className="flex-1 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 text-sm">
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
