import { useEffect } from "react";
import { useI18n, type Lang } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { Segmented } from "./components";

/** English / Español switch. Saved on the device and, when signed in, on the account. */
export function LanguageToggle() {
  const { lang, setLang } = useI18n();
  const { user, updateUser } = useAuth();
  return (
    <Segmented<Lang>
      value={lang}
      onChange={(l) => {
        setLang(l);
        if (user && user.language !== l) void updateUser({ language: l }).catch(() => {});
      }}
      options={[
        { value: "en", label: "English" },
        { value: "es", label: "Español" },
      ]}
    />
  );
}

/** When someone signs in, their saved account language wins. */
export function LanguageSync() {
  const { user } = useAuth();
  const { lang, setLang } = useI18n();
  useEffect(() => {
    if (user?.language && user.language !== lang) setLang(user.language);
    // Only react to the account changing, not to local toggles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.language]);
  return null;
}
