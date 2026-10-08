import { useEffect, useMemo, useState } from 'react'
import { ChevronIcon, DashLogo, useTheme } from 'dash-ui-kit/react'
import { Text, Button, Input } from '@renderer/components/dash-ui-kit-enxtended'
import { Link } from 'react-router-dom'
import {
  authTexts,
  forgotPasswordTexts,
  messages,
} from '@renderer/constants'
import { ForgotPasswordStep } from '@renderer/enums/ForgotPasswordStep'
import { useWallets, refreshWallets } from '@renderer/hooks/useWallets'
import { toast } from '@renderer/components/ui/Toast'
import { toDropdownOptions } from '@renderer/utils/wallets'
import { getPasswordValidationError } from '@renderer/utils/passwordValidation'
import { useRipple } from '@renderer/hooks/useRipple'
import AuthBackground from '@renderer/components/pages/auth/AuthBackground'
import WalletSelect from '@renderer/components/ui/WalletSelect'
import ImportSeedPhrase from '@renderer/components/pages/auth/ImportSeedPhrase'
import { API } from '@renderer/api'

export default function ForgotPasswordPage(): React.JSX.Element {
  const { title, description, form } = forgotPasswordTexts
  const { seedPhraseWarning } = authTexts
  const { forgotPassword: { seedMismatch, resetFailed }, createWallet: { passwordValidation } } = messages
  const { theme } = useTheme()
  const iconColor = theme === 'dark' ? '#ffffff' : ''
  const hoverAnimation = useRipple()

  const wallets = useWallets()
  const walletOptions = useMemo(() => toDropdownOptions(wallets), [wallets])
  const [pickedWalletId, setPickedWalletId] = useState<string | null>(null)
  const selectedWalletId = pickedWalletId
    ?? wallets.find((w) => w.selected)?.walletId
    ?? wallets[0]?.walletId
    ?? null

  useEffect(() => {
    refreshWallets()
  }, [])

  const [step, setStep] = useState<ForgotPasswordStep>(ForgotPasswordStep.Seed)
  const [mnemonic, setMnemonic] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSeedSubmit = async (words: string[]): Promise<void> => {
    if (!selectedWalletId || busy) return
    const phrase = words.join(' ')
    setBusy(true)
    try {
      const ok = await API.verifyWalletMnemonic(selectedWalletId, phrase)
      if (!ok) {
        toast.error(seedMismatch)
        return
      }
      setMnemonic(phrase)
      setStep(ForgotPasswordStep.Password)
    } catch {
      toast.error(seedMismatch)
    } finally {
      setBusy(false)
    }
  }

  const handleReset = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!selectedWalletId || mnemonic === null || busy) return
    const pwdError = getPasswordValidationError(password)
    if (pwdError !== null) {
      toast.error(pwdError)
      return
    }
    if (password !== confirmPassword) {
      toast.error(passwordValidation.passwordsDoNotMatch)
      return
    }
    setBusy(true)
    try {
      const ok = await API.resetWalletPassword(selectedWalletId, mnemonic, password)
      if (ok) {
        setStep(ForgotPasswordStep.Success)
      } else {
        toast.error(resetFailed)
      }
    } catch {
      toast.error(resetFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={"relative flex min-h-screen items-end"}>
      <AuthBackground variant="login" />

      {step !== ForgotPasswordStep.Success && (
        <Link
          to="/"
          aria-label={form.backToLogin}
          onMouseEnter={hoverAnimation.onMouseEnter}
          onMouseMove={hoverAnimation.onMouseMove}
          onMouseLeave={hoverAnimation.onMouseLeave}
          className="absolute top-12 left-12 z-50 flex size-12 items-center justify-center overflow-hidden rounded-[.9375rem] bg-dash-brand/80 dark:bg-white/12 backdrop-blur-[.5rem] cursor-pointer"
        >
          <ChevronIcon size={17} className="rotate-90 text-white" />
        </Link>
      )}

      <div className={"relative flex flex-col w-full h-full p-12 pt-[max(9rem,25vh)]"}>
        <div className={"flex flex-col w-full mb-8"}>
          <DashLogo containerSize={50} />
          <Text as={"h1"} className={"mt-6 leading-[78%] tracking-[-0.03em]"} color={"brand"} size={64} weight={"extrabold"}>
            {title}
          </Text>
          <Text as={"p"} className={"mt-6"} color={"brand"} size={18} weight={"medium"} opacity={50}>
            {description[step]}
          </Text>
        </div>

        {step === ForgotPasswordStep.Seed && (
          <div className={"flex flex-col gap-6 w-full"}>
            <div className={"flex flex-col gap-[.625rem] max-w-100"}>
              <Text as={"label"} size={16} weight={"medium"} color={"brand"} opacity={50}>
                {form.walletLabel}
              </Text>
              <WalletSelect
                options={walletOptions}
                disabled={wallets.length <= 1}
                value={selectedWalletId ?? ''}
                onChange={setPickedWalletId}
              />
            </div>
            <ImportSeedPhrase
              submitImportSeedPhrase={handleSeedSubmit}
              data={{
                buttonContinue: form.continueButton,
                seedPhraseWarning: seedPhraseWarning
              }}
            />
          </div>
        )}

        {step === ForgotPasswordStep.Password && (
          <form onSubmit={handleReset} className={"flex flex-col gap-3.75 w-full"}>
            <div className={"grid grid-cols-2 gap-3.75"}>
              <div className={"flex flex-col gap-[.625rem]"}>
                <label htmlFor={"new-password-input"}>
                  <Text as={"label"} size={16} weight={"medium"} color={"brand"} opacity={50}>
                    {form.newPasswordLabel}
                  </Text>
                </label>
                <Input
                  id={"new-password-input"}
                  type={"password"}
                  placeholder={form.newPasswordPlaceholder}
                  value={password}
                  variant={"outlined"}
                  onChange={(e) => setPassword(e.target.value)}
                  className={"h-full rounded-[1.25rem] bg-transparent!"}
                  iconColor={iconColor}
                  colorScheme={"primary"}
                />
              </div>
              <div className={"flex flex-col gap-[.625rem]"}>
                <label htmlFor={"confirm-new-password-input"}>
                  <Text as={"label"} size={16} weight={"medium"} color={"brand"} opacity={50}>
                    {form.confirmPasswordLabel}
                  </Text>
                </label>
                <Input
                  id={"confirm-new-password-input"}
                  type={"password"}
                  placeholder={form.confirmPasswordPlaceholder}
                  value={confirmPassword}
                  variant={"outlined"}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={"h-full rounded-[1.25rem] bg-transparent!"}
                  iconColor={iconColor}
                  colorScheme={"primary"}
                />
              </div>
            </div>
            <Button
              type={"submit"}
              colorScheme={"primary"}
              size={"md"}
              className={"rounded-[1.25rem] p-4.5"}
              disabled={!password.trim() || !confirmPassword.trim() || busy}
            >
              {form.resetButton}
            </Button>
          </form>
        )}

        {step === ForgotPasswordStep.Success && (
          <Link to={"/"} className={"w-full"}>
            <Button
              type={"button"}
              colorScheme={"primary"}
              size={"md"}
              className={"rounded-[1.25rem] p-4.5 w-full"}
            >
              {form.backToLogin}
            </Button>
          </Link>
        )}

      </div>
    </div>
  )
}
