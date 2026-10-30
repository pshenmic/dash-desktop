import { Button } from "@renderer/components/dash-ui-kit-extended";

type WelcomeProps = {
  onCreateWallet: () => void
  onImportSeedPhrase: () => void
  data: {
    createWallet: string
    importSeedPhrase: string
  }
}

export default function WelcomeDashDesktopWallet({ onCreateWallet, onImportSeedPhrase, data }: WelcomeProps): React.JSX.Element {
  return (
    <div className={"flex flex-row gap-3 w-full"}>
      <Button
        colorScheme={"primary"}
        size={"md"}
        className={"flex-1 p-4.5"}
        onClick={onCreateWallet}
      >
        {data.createWallet}
      </Button>
      <Button
        colorScheme={"lightBlue-mint"}
        size={"md"}
        className={"flex-1 p-4.5"}
        onClick={onImportSeedPhrase}
      >
        {data.importSeedPhrase}
      </Button>
    </div>
  )
}
