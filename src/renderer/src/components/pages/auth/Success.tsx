import { Button, Text } from "@renderer/components/dash-ui-kit-enxtended";
import { SuccessTexts } from "@renderer/constants";
import { DashLogo, useTheme } from "dash-ui-kit/react";
import { useNavigate } from "react-router-dom";
import bgLight from '@renderer/assets/images/pageAuthorization/success-background-light.png';
import bgDark from '@renderer/assets/images/pageAuthorization/success-background-dark.png';
import { useAuth } from "@renderer/contexts/AuthContext";

interface SuccessProps {
  data: SuccessTexts
  walletId?: string | null
}

export default function Success({ data, walletId }: SuccessProps): React.JSX.Element {
  const { theme } = useTheme()
  const backgroundImage = theme === 'dark' ? bgDark : bgLight
  const navigate = useNavigate()
  const { switchWallet } = useAuth()

  const handleContinue = async (): Promise<void> => {
    if (walletId) {
      await switchWallet(walletId)
      return
    }
    navigate("/")
  }

  return (
    <div className={"flex w-full h-screen items-center justify-center"}>
      <img
        src={backgroundImage}
        alt={"background gradient"}
        className={"absolute inset-0 w-full h-full object-cover pointer-events-none"}
      />
      <div className={"flex flex-col w-fit items-center"}>
        <DashLogo  containerSize={50}/>
        <Text as={"h1"} className={"leading-[125%] tracking-[-0.03em] text-center"} color={"brand"} size={40} weight={"extrabold"}>
          {data.title} <br/> <span className={"text-dash-brand"}>{data.subtitle}</span>
        </Text>
        <Text as={"p"} className={"mt-[.625rem]"} color={"brand"} size={14} weight={"medium"} opacity={50}>{data.description}</Text>
        <Button
          colorScheme={"brand"}
          size={"md"}
          className={"mt-8 w-full"}
          onClick={handleContinue}
          aria-label={data.buttonContinue}
        >
          {data.buttonContinue}
        </Button>
      </div>
    </div>
  )
}
