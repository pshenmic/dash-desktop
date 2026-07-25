import { useEffect, useMemo, useState } from 'react'
import { DashLogo, useTheme } from 'dash-ui-kit/react'
import { Text, Button, Input, WalletIcon } from '@renderer/components/dash-ui-kit-enxtended'
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
import bgLight from '@renderer/assets/images/pageAuthorization/bg-light.svg'
import bgDark from '@renderer/assets/images/pageAuthorization/bg-dark.svg'
import wave from '@renderer/assets/images/pageAuthorization/wave.png'
import WalletSelect from '@renderer/components/ui/WalletSelect'
import ImportSeedPhrase from '@renderer/components/pages/auth/ImportSeedPhrase'
import { API } from '@renderer/api'

export default function ForgotPasswordPage(): React.JSX.Element {
  const { title, description, form } = forgotPasswordTexts
  const { seedPhraseWarning } = authTexts
  const { forgotPassword: { seedMismatch, resetFailed }, createWallet: { passwordValidation } } = messages
  const { theme } = useTheme()
  const backgroundImage = theme === 'dark' ? bgDark : bgLight
  const iconColor = theme === 'dark' ? '#ffffff' : ''

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
      <img
        src={backgroundImage}
        alt={"background gradient"}
        className={"dash-bg-image-auth"}
      />
      <img
        src={wave}
        alt={"wave"}
        className={"dash-bg-image-auth"}
      />

      <div className={"relative flex flex-col w-full h-full p-12 pt-[25vh]"}>
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

        {step !== ForgotPasswordStep.Success && (
          <div className={"flex items-center justify-center gap-[.9375rem] mt-6"}>
            <Link
              to={"/"}
              className={"flex items-center gap-2 group"}
              aria-label={`${form.backToLogin} link`}
            >
              <WalletIcon
                size={16}
                className={`
                  dash-text-default opacity-35
                  group-hover:opacity-100
                  group-hover:text-dash-brand
                  dark:group-hover:text-dash-mint
                  transition-[opacity,color]
                `}
              />
              <Text
                size={16}
                color={"brand"}
                opacity={30}
                className={`
                  group-hover:opacity-100
                  group-hover:text-dash-brand
                  dark:group-hover:text-dash-mint
                  transition-[opacity,color]
                `}
              >
                {form.backToLogin}
              </Text>
            </Link>
          </div>
        )}

      </div>
    </div>
  )
}
