import { useTranslation } from 'react-i18next';
import { useAccessibility } from '@/hooks/useAccessibility';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Globe, Eye, Type } from 'lucide-react';

const languages = [
  { code: 'pt-BR', label: 'Português (BR)', flag: '🇧🇷' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
];

const fontSizes = [
  { value: 'small' as const, labelKey: 'common.fontSizeSmall' },
  { value: 'medium' as const, labelKey: 'common.fontSizeMedium' },
  { value: 'large' as const, labelKey: 'common.fontSizeLarge' },
  { value: 'extra-large' as const, labelKey: 'common.fontSizeExtraLarge' },
];

export default function AccessibilityMenu() {
  const { t, i18n } = useTranslation();
  const { highContrast, toggleHighContrast, fontSize, setFontSize } = useAccessibility();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('a11y.accessibilitySettings')}
          className="relative"
        >
          <Globe className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end" role="dialog" aria-label={t('a11y.accessibilitySettings')}>
        <div className="space-y-4">
          {/* Language */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
              <Globe className="w-3.5 h-3.5" /> {t('common.language')}
            </Label>
            <div className="grid grid-cols-1 gap-1" role="radiogroup" aria-label={t('a11y.languageSelector')}>
              {languages.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => i18n.changeLanguage(lang.code)}
                  role="radio"
                  aria-checked={i18n.language === lang.code}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    i18n.language === lang.code
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent text-foreground'
                  }`}
                >
                  <span>{lang.flag}</span>
                  <span>{lang.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* High Contrast */}
          <div className="flex items-center justify-between">
            <Label htmlFor="high-contrast" className="text-sm flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" /> {t('common.highContrast')}
            </Label>
            <Switch
              id="high-contrast"
              checked={highContrast}
              onCheckedChange={toggleHighContrast}
              aria-label={t('a11y.toggleHighContrast')}
            />
          </div>

          {/* Font Size */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
              <Type className="w-3.5 h-3.5" /> {t('common.fontSize')}
            </Label>
            <div className="grid grid-cols-4 gap-1" role="radiogroup" aria-label={t('a11y.adjustFontSize')}>
              {fontSizes.map(fs => (
                <button
                  key={fs.value}
                  onClick={() => setFontSize(fs.value)}
                  role="radio"
                  aria-checked={fontSize === fs.value}
                  className={`px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    fontSize === fs.value
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent text-foreground'
                  }`}
                >
                  {t(fs.labelKey)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
