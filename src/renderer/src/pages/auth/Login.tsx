import { DashLogo, useTheme } from 'dash-ui-kit/react'
import { Text, Button, Input, WalletIcon } from '@renderer/components/dash-ui-kit-enxtended'
import { Link, useNavigate } from 'react-router-dom'
import { loginTexts, messages } from '@renderer/constants'
import { useLogin } from '@renderer/hooks/useLogin'
import { toast } from '@renderer/components/ui/Toast'
import { useEffect, useMemo } from 'react'
import { useAuth } from '@renderer/contexts/AuthContext'
import { toDropdownOptions } from '@renderer/utils/wallets'
import bgLight from '@renderer/assets/images/pageAuthorization/bg-light.svg'
import bgDark from '@renderer/assets/images/pageAuthorization/bg-dark.svg'
import wave from '@renderer/assets/images/pageAuthorization/wave.png'
import WalletSelect from '@renderer/components/ui/WalletSelect'

export default function LoginPage(): React.JSX.Element {
  const { title, description, form, links } = loginTexts
  const { login: { invalidPassword } } = messages
  const { theme } = useTheme()
  const backgroundImage = theme === 'dark' ? bgDark : bgLight
  const iconColor = theme === 'dark' ? '#ffffff' : ''
  const navigate = useNavigate()
  const { preselectedWalletId, loginSuccess } = useAuth()

  const {
    wallets,
    isLoading,
    selectedWalletId,
    setSelectedWalletId,
    password,
    setPassword,
    hasError,
    login,
  } = useLogin()

  useEffect(() => {
    if (isLoading) return
    if (wallets.length === 0) {
      navigate(links.register.to, { replace: true })
    }
  }, [wallets, isLoading, navigate, links.register.to])

  const walletOptions = useMemo(() => toDropdownOptions(wallets), [wallets])

  useEffect(() => {
    if (isLoading) return
    if (!preselectedWalletId) return
    const exists = wallets.some((w) => w.walletId === preselectedWalletId)
    if (exists) setSelectedWalletId(preselectedWalletId)
  }, [isLoading, wallets, preselectedWalletId, setSelectedWalletId])

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const success = await login()
    if (success) {
      await loginSuccess()
    } else {
      toast.error(invalidPassword)
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
            {description}
          </Text>
        </div>

        <form onSubmit={handleSubmit} className={"flex flex-col gap-3.75 w-full"}>
          <div className={"grid grid-cols-2 gap-3.75"}>
            <div className={"flex flex-col gap-[.625rem]"}>
              <Text as={"label"} size={16} weight={"medium"} color={"brand"} opacity={50}>
                {form.walletLabel}
              </Text>
              <WalletSelect
                options={walletOptions}
                disabled={wallets.length <= 1}
                value={selectedWalletId ?? ''}
                onChange={setSelectedWalletId}
              />
            </div>

            <div className={"flex flex-col gap-[.625rem]"}>
              <label htmlFor={"password-input"}>
                <Text as={"label"} size={16} weight={"medium"} color={"brand"} opacity={50}>
                  {form.passwordLabel}
                </Text>
              </label>
              <div className="flex-1 [&>div]:h-full">
                <Input
                  id={"password-input"}
                  type={"password"}
                  placeholder={form.passwordPlaceholder}
                  value={password}
                  variant={"outlined"}
                  onChange={(e) => setPassword(e.target.value)}
                  className={"h-full rounded-[1.25rem] bg-transparent!"}
                  iconColor={iconColor}
                  colorScheme={hasError ? 'error' : 'primary'}
                />
              </div>
            </div>
          </div>

          <Button
            type={"submit"}
            colorScheme={"primary"}
            size={"md"}
            className={"rounded-[1.25rem] p-4.5"}
            disabled={!password || !selectedWalletId}
          >
            {form.submitButton}
          </Button>
        </form>

        <div className={"flex items-center justify-center gap-[.9375rem] mt-6"}>
          <Link
            to={links.register.to}
            className={"flex items-center gap-2 group"}
            aria-label={`${links.register.label} link`}
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
              {links.register.label}
            </Text>
          </Link>
          <span className={"h-4 w-px dash-block-solid opacity-35"} />
          <Link
            to={links.forgotPassword.to}
            className={"group"}
            aria-label={`${links.forgotPassword.label} link`}
          >
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
              {links.forgotPassword.label}
            </Text>
          </Link>
        </div>
      </div>
    </div>
  )
}
