import '../styles/design-system.css'
import thinkTogetherLogo from '../assets/think-together-logo.png'

export type BrandHeaderMode = 'learner' | 'admin'

export type BrandHeaderProps = {
  mode: BrandHeaderMode
  showAdminMode?: boolean
  onModeChange: (mode: BrandHeaderMode) => void
}

const modes: Array<{ value: BrandHeaderMode; label: string }> = [
  { value: 'learner', label: 'Learner mode' },
  { value: 'admin', label: 'Admin mode' },
]

export function BrandHeader({ mode, showAdminMode = true, onModeChange }: BrandHeaderProps) {
  const availableModes = showAdminMode ? modes : modes.filter((option) => option.value !== 'admin')

  return (
    <header className="tt-brand-header" aria-label="Think Together training MVP">
      <div className="tt-brand-header__identity">
        <img className="tt-brand-header__logo" src={thinkTogetherLogo} alt="Think Together logo" />
        <div>
          <p className="tt-brand-header__eyebrow">Think Together</p>
          <h1 className="tt-brand-header__title" aria-label="Think Together Training MVP">
            <span className="tt-brand-header__title-prefix">Think Together </span>
            Training MVP
          </h1>
        </div>
      </div>

      <fieldset className="tt-mode-switch" aria-label="Training workspace mode">
        <legend className="tt-sr-only">Training workspace mode</legend>
        {availableModes.map((option) => (
          <label
            className="tt-mode-switch__option"
            data-active={mode === option.value}
            key={option.value}
          >
            <input
              checked={mode === option.value}
              name="tt-mode"
              onChange={() => onModeChange(option.value)}
              type="radio"
              value={option.value}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>
    </header>
  )
}
