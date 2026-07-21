import { useState, useRef, useEffect } from 'react'
import { Input, Text } from '@renderer/components/dash-ui-kit-enxtended'
import { SearchIcon, PlusIcon, DeleteIcon, CheckIcon } from '@renderer/components/dash-ui-kit-enxtended/icons'
import { Avatar, Identifier } from 'dash-ui-kit/react'
import { TransferPageType } from '@renderer/constants'
import { useAddressBook } from '@renderer/hooks/useAddressBook'
import { isValidDashAddress } from '@renderer/utils/address'
import { toast } from '@renderer/components/ui/Toast'

interface RecipientInputProps {
  value: string
  onChange: (value: string) => void
  data: TransferPageType['recipient']
}

export default function RecipientInput({
  value,
  onChange,
  data,
}: RecipientInputProps) {
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { contacts, network, addContact, deleteContact } = useAddressBook()

  const query = value.toLowerCase().trim()
  const filteredContacts = contacts.filter(
    (c) =>
      c.address.toLowerCase().includes(query) ||
      c.label.toLowerCase().includes(query),
  )

  const trimmedValue = value.trim()
  const isValidRecipient = isValidDashAddress(trimmedValue, network)
  const alreadySaved = contacts.some((c) => c.address === trimmedValue)
  const canSaveCurrent = isValidRecipient && !alreadySaved

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setAdding(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectAddress = (address: string): void => {
    onChange(address)
    setOpen(false)
  }

  const handleSaveContact = async (): Promise<void> => {
    const label = newLabel.trim()
    if (label.length === 0) {
      toast.error('**Name required** Enter a name for this contact.')
      return
    }
    const res = await addContact(label, trimmedValue)
    if (res.success) {
      setAdding(false)
      setNewLabel('')
    } else if (res.errorMessage) {
      toast.error(`**Could not save contact** ${res.errorMessage}`)
    }
  }

  return (
    <div className={"flex flex-col gap-2"}>
      <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[120%]"}>
        {data.label}
      </Text>
      <div className={"dash-block rounded-[.875rem] overflow-hidden"} ref={containerRef}>
        <div
          className={"flex items-center justify-between gap-1 px-4 py-3.5 [&>*:first-child]:flex-1"}
          onClick={() => inputRef.current?.focus()}
        >
          <Input
            ref={inputRef}
            type={"text"}
            value={value}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
            className={"outline-none text-[.875rem] dash-text-default placeholder:opacity-40 !ring-0 p-0 w-full"}
            placeholder={data.placeholder}
            colorScheme={"transparent"}
            prefixClassName={"flex items-center"}
            prefix={
              <Avatar
                username={"account"}
                className={"size-5"}
              />
            }
          />
          {trimmedValue.length > 0 && (
            isValidRecipient ? (
              <CheckIcon size={18} className={"text-dash-brand dark:text-dash-mint shrink-0 [&_circle]:hidden"} />
            ) : (
              <Text size={10} weight={"medium"} color={"red"} className={"shrink-0"}>Invalid</Text>
            )
          )}
          <button
            type={"button"}
            onClick={(e) => { e.stopPropagation(); setOpen(v => !v) }}
            title={data.addressBook}
            className={"shrink-0 flex items-center justify-center cursor-pointer hover:opacity-70 transition-opacity"}
          >
            <SearchIcon size={18} className={`dash-text-default shrink-0 transition-opacity ${open ? 'opacity-100' : 'opacity-40'}`} />
          </button>
        </div>

        <div
          className={`
            transition-all duration-300 ease-in-out
            ${open
              ? 'max-h-145 opacity-100'
              : 'max-h-0 opacity-0'
            }
          `}
          style={{ overflow: 'hidden' }}
        >
          <div className={"px-5"}>
            <div className={"flex items-center justify-between pb-[.75rem]"}>
              <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
                {data.addressBook}:
              </Text>
              {canSaveCurrent && !adding && (
                <button
                  onClick={() => setAdding(true)}
                  className={"text-xs dash-block-3 px-[.75rem] py-[.5rem] rounded-[.75rem] flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"}
                >
                  <PlusIcon size={10} color={"currentColor"} className={"dash-text-default"} />
                  <Text size={10} weight={"medium"} color={"brand"} className={"leading-[120%]"}>
                    Save current
                  </Text>
                </button>
              )}
            </div>

            {adding && (
              <div className={"flex items-center gap-2 pb-[.75rem]"}>
                <Input
                  type={"text"}
                  value={newLabel}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewLabel(e.target.value)}
                  placeholder={"Contact name"}
                  colorScheme={"transparent"}
                  className={"flex-1 outline-none text-[.875rem] dash-text-default placeholder:opacity-40 !ring-0 dash-block-3 rounded-[.75rem] px-3 py-2"}
                />
                <button
                  onClick={handleSaveContact}
                  className={"dash-block-accent-15 rounded-[.75rem] px-3 py-2 cursor-pointer hover:opacity-80 transition-opacity"}
                >
                  <Text size={10} weight={"medium"} color={"blue-mint"}>Save</Text>
                </button>
                <button
                  onClick={() => { setAdding(false); setNewLabel('') }}
                  className={"dash-block-3 rounded-[.75rem] px-3 py-2 cursor-pointer hover:opacity-80 transition-opacity"}
                >
                  <Text size={10} weight={"medium"} color={"brand"}>Cancel</Text>
                </button>
              </div>
            )}

            <div className={"max-h-29.25 overflow-y-auto scrollbar-hide flex flex-col gap-[.5rem] pb-[.75rem]"}>
              {filteredContacts.length > 0 ? (
                filteredContacts.map((entry) => (
                  <div
                    key={entry.id}
                    className={"w-full p-[.9375rem] dash-block-3 rounded-[.9375rem] flex flex-col gap-[.75rem]"}
                  >
                    <div className={"flex items-start justify-between gap-2"}>
                      <button
                        onClick={() => handleSelectAddress(entry.address)}
                        className={"flex-1 min-w-0 text-left cursor-pointer"}
                      >
                        <Identifier
                          highlight={"both"}
                          className={"font-mono text-left"}
                        >
                          {entry.address}
                        </Identifier>
                      </button>
                      <button
                        onClick={() => deleteContact(entry.id)}
                        className={"shrink-0 flex items-center justify-center size-6 rounded-md hover:bg-dash-primary-dark-blue/5 dark:hover:bg-white/5 cursor-pointer"}
                        title={"Remove contact"}
                      >
                        <DeleteIcon size={12} color={"currentColor"} className={"dash-text-default opacity-50"} />
                      </button>
                    </div>
                    <div className={"flex items-center gap-2"}>
                      <div className={"px-2 py-1 dash-block-3 rounded-[.3125rem] flex"}>
                        <Text size={12} weight="medium" color="default" opacity={50}>
                          {data.names}:
                        </Text>
                      </div>
                      <div className={"px-2 py-1 dash-block-3 rounded-[.3125rem] flex"}>
                        <Text size={12} weight={"medium"} color={"default"}>
                          {entry.label}
                        </Text>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className={"p-4 text-center"}>
                  <Text size={14} weight={"normal"} color={"default"} opacity={50}>
                    {contacts.length === 0 ? 'No saved contacts yet' : data.noResults}
                  </Text>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
