import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      // Bekräftelser ska hinna läsas: högst upp, i färg, kvar i 7 sekunder och
      // med en stängknapp.
      position="top-center"
      richColors
      closeButton
      duration={7000}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:text-[0.9375rem] group-[.toaster]:shadow-lg group-[.toaster]:py-4",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
