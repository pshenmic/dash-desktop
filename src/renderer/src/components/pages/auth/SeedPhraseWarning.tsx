import { Text } from "@renderer/components/dash-ui-kit-extended";
import { ExclamationIcon } from "@renderer/components/dash-ui-kit-extended/icons";

export default function SeedPhraseWarning({ title, description }: { title: string, description: string }): React.JSX.Element {
  return (
    <div className={"flex items-center gap-[.75rem] p-[.75rem] dash-card-base rounded-[.9375rem] shadow-[0_0_75px_0_rgba(0,0,0,0.1)]"}>
      <div className={"flex items-center justify-center size-[1.6563rem] rounded-full dash-block-3"}>
        <ExclamationIcon className={"dash-text-default"} />
      </div>
      <div className={"flex flex-col"}>
        <Text size={12} weight={"extrabold"} color={"brand"}>
          {title}
        </Text>
        <Text size={12} weight={"medium"} color={"brand"}>
          {description}
        </Text>
      </div>
    </div>
  );
}
