import { Text, WalletIcon } from "@renderer/components/dash-ui-kit-enxtended";
import { ChevronIcon, DashLogo, useTheme } from "dash-ui-kit/react";
import { authTexts } from "@renderer/constants";
import { useCreateWallet } from "@renderer/hooks/useCreateWallet";
import { ProgressStepBar } from "@renderer/components/dash-ui-kit-enxtended/progressStepBar";
import { useRipple } from "@renderer/hooks/useRipple";
import waveAuth from '@renderer/assets/images/pageAuthorization/waveAuth.png';
import authBgFlower from '@renderer/assets/images/pageAuthorization/auth-bg-flower.png';
import bgLight from '@renderer/assets/images/pageAuthorization/Frame 717779 (1).png';
import bgDark from '@renderer/assets/images/pageAuthorization/Frame 717781 (1).png';
import CreateWallet from "../../components/pages/auth/CreateWallet";
import SeedPhrase from "../../components/pages/auth/SeedPhrase";
import VerifySeedPhrase from "../../components/pages/auth/VerifySeedPhrase";
import Success from "../../components/pages/auth/Success";
import WelcomeDashDesktopWallet from "@renderer/components/pages/auth/WelcomeDashDesktopWallet"
import ImportSeedPhrase from "@renderer/components/pages/auth/ImportSeedPhrase";
import NetworkBadge from "@renderer/components/ui/NetworkBadge";
import { useAuth } from "@renderer/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useWallets, refreshWallets } from "@renderer/hooks/useWallets";

export default function CreateWalletWrapper(): React.JSX.Element {
  const {createWallet, saveYourSeedPhrase, fillInYourSeedPhrase, seedPhraseWarning, success, successImport, welcome, importSeedPhrase} = authTexts
  const { theme } = useTheme()
  const backgroundImage = theme === 'dark' ? bgDark : bgLight

  const {
    step,
    generateSeedPhrase,
    setPassword,
    password,
    seedPhrase,
    wordCount,
    setWordCount,
    verifySeedPhrase,
    verifyPhrase,
    verifyMissingWords,
    goBack,
    network,
    setNetwork,
    goToPassword,
    goToImportSeedPhrase,
    submitImportSeedPhrase,
    createImportedWallet,
    path,
    createdWalletId
  } = useCreateWallet()
  const hoverAnimation = useRipple()
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const wallets = useWallets()

  useEffect(() => {
    refreshWallets()
  }, [])

  const canExitWelcome = step === 'welcome' && (isAuthenticated || wallets.length > 0)
  const showBackButton = step !== 'welcome' || canExitWelcome
  const handleBack = (): void => {
    if (canExitWelcome) {
      navigate('/')
      return
    }
    goBack()
  }

  const title = step === 'password' ? createWallet.title :
  step === 'seed-phrase' ? saveYourSeedPhrase.title :
  step === 'verify' ? fillInYourSeedPhrase.title :
  step === 'welcome' ?
  <span className={"inline-block max-w-125 leading-[100%]"}>
    <span className={"font-normal"}>{welcome.titlePrefix}</span> <span className={"font-bold"}>{welcome.titleHighlight}</span>
  </span> :
  step === 'import-seed-phrase' ? importSeedPhrase.title :
  step === 'password-import' ? 'Create Password' : ''

  const description = step === 'password' ? createWallet.description :
  step === 'seed-phrase' ? saveYourSeedPhrase.description :
  step === 'verify' ? fillInYourSeedPhrase.description :
  step === 'welcome' ? welcome.description :
  step === 'import-seed-phrase' ? importSeedPhrase.description :
  step === 'password-import' ? createWallet.description : ''

  const wave = step === 'welcome' ? authBgFlower : waveAuth

  if (step === 'success') return <Success data={path === 'create' ? success : successImport} walletId={createdWalletId} />

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

      {showBackButton &&
        <button
          onMouseEnter={hoverAnimation.onMouseEnter}
          onMouseMove={hoverAnimation.onMouseMove}
          onMouseLeave={hoverAnimation.onMouseLeave}
          className={`
            z-50
            absolute
            top-12
            left-12
            overflow-hidden
            size-12
            flex
            items-center
            justify-center
            rounded-[.9375rem]
            cursor-pointer
            bg-white/12
            backdrop-blur-[.5rem]
          `}
          onClick={handleBack}
        >
          <ChevronIcon
            size={17}
            className={`
            text-white
            rotate-90
          `}/>
        </button>
      }

      <NetworkBadge network={network} onChange={setNetwork} />

      <div className={"relative flex flex-col w-full h-full items-center justify-end p-12 pt-[25vh] "}>
        <div className={"flex flex-col w-full mb-8"}>
          <DashLogo  containerSize={50}/>
          <Text as={"h1"} className={"mt-6 leading-[78%] tracking-[-0.03em]"} color={"brand"} size={64} weight={"extrabold"}>{title}</Text>
          <Text as={"p"} className={"mt-6"} color={"brand"}size={18} weight={"medium"} opacity={50}>{description}</Text>
        </div>

        {step === 'welcome' &&
          <WelcomeDashDesktopWallet onCreateWallet={goToPassword} onImportSeedPhrase={goToImportSeedPhrase} data={{
            createWallet: welcome.buttonCreateWallet,
            importSeedPhrase: welcome.buttonImportSeedPhrase,
          }} />
        }

        {step === 'password' &&
          <CreateWallet
            setPassword={setPassword}
            password={password}
            generateSeedPhrase={generateSeedPhrase}
            data={{
              labelConfirmPassword: createWallet.labelConfirmPassword,
              placeholderConfirmPassword: createWallet.placeholderConfirmPassword,
              buttonNext: createWallet.buttonNext,
              labelPassword: createWallet.labelPassword,
              placeholderPassword: createWallet.placeholderPassword
            }}
          />
        }

        {step === 'password-import' &&
          <CreateWallet
            setPassword={setPassword}
            password={password}
            createImportedWallet={createImportedWallet}
            data={{
              labelConfirmPassword: createWallet.labelConfirmPassword,
              placeholderConfirmPassword: createWallet.placeholderConfirmPassword,
              buttonNext: createWallet.buttonNext,
              labelPassword: createWallet.labelPassword,
              placeholderPassword: createWallet.placeholderPassword
            }}
          />
        }
        {step === 'seed-phrase' &&
          <SeedPhrase
            data={{
              buttonContinue: saveYourSeedPhrase.buttonContinue,
              buttonCopy: saveYourSeedPhrase.buttonCopy,
              seedPhraseWarning: seedPhraseWarning
            }}
            seedPhrase={seedPhrase}
            verifySeedPhrase={verifySeedPhrase}
            wordCount={wordCount}
            setWordCount={setWordCount}
        />}
        {step === 'verify' &&
          <VerifySeedPhrase
            verifyPhrase={verifyPhrase}
            verifyMissingWords={verifyMissingWords}
            data={{
              buttonContinue: fillInYourSeedPhrase.buttonContinue,
              seedPhraseWarning: seedPhraseWarning
            }}
        />}

        {step === 'import-seed-phrase' &&
          <ImportSeedPhrase
            submitImportSeedPhrase={submitImportSeedPhrase}
            data={{
              buttonContinue: importSeedPhrase.buttonContinue,
              seedPhraseWarning: seedPhraseWarning
            }}
          />
        }

        {step !== 'welcome' &&
          <ProgressStepBar
            currentStep={path === 'create' ? (step === 'password' ? 1 : step === 'seed-phrase' ? 2 : 3) : (step === 'import-seed-phrase' ? 1 : 2)}
            totalSteps={path === 'create' ? 3 : 2}
            className={"mt-[.75rem]"}
            color={"blue-mint"}
          />
        }

        {step === 'password' &&
          <button className={"flex items-center gap-2 group cursor-pointer mt-6"} onClick={goToImportSeedPhrase}>
            <WalletIcon
              size={16}
              className={`
              dash-text-default
              opacity-35
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
              `}>
              {createWallet.importWallet}
            </Text>
          </button>
        }
      </div>
    </div>
  )
}
