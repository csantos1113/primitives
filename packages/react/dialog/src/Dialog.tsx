import * as React from 'react';
import { composeEventHandlers } from '@radix-ui/primitive';
import { useComposedRefs } from '@radix-ui/react-compose-refs';
import { createContext, createContextScope } from '@radix-ui/react-context';
import { useId } from '@radix-ui/react-id';
import { useControllableState } from '@radix-ui/react-use-controllable-state';
import { DismissableLayer } from '@radix-ui/react-dismissable-layer';
import { FocusScope } from '@radix-ui/react-focus-scope';
import { UnstablePortal } from '@radix-ui/react-portal';
import { Presence } from '@radix-ui/react-presence';
import { Primitive } from '@radix-ui/react-primitive';
import { useFocusGuards } from '@radix-ui/react-focus-guards';
import { RemoveScroll } from 'react-remove-scroll';
import { hideOthers } from 'aria-hidden';

import type * as Radix from '@radix-ui/react-primitive';
import type { Scope } from '@radix-ui/react-context';

/* -------------------------------------------------------------------------------------------------
 * Dialog
 * -----------------------------------------------------------------------------------------------*/

const DIALOG_NAME = 'Dialog';

type ScopedProps<P> = P & { __scopeDialog?: Scope };
const [createDialogContext, createDialogScope] = createContextScope(DIALOG_NAME);

type DialogContextValue = {
  triggerRef: React.RefObject<HTMLButtonElement>;
  contentId: string;
  titleId: string;
  descriptionId: string;
  open: boolean;
  onOpenChange(open: boolean): void;
  onOpenToggle(): void;
  modal: boolean;
  allowPinchZoom: DialogProps['allowPinchZoom'];
};

const [DialogProvider, useDialogContext] = createDialogContext<DialogContextValue>(DIALOG_NAME);

type RemoveScrollProps = React.ComponentProps<typeof RemoveScroll>;
interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?(open: boolean): void;
  modal?: boolean;
  /**
   * @see https://github.com/theKashey/react-remove-scroll#usage
   */
  allowPinchZoom?: RemoveScrollProps['allowPinchZoom'];
  children?: React.ReactNode;
}

const Dialog: React.FC<DialogProps> = (props: ScopedProps<DialogProps>) => {
  const {
    __scopeDialog,
    children,
    open: openProp,
    defaultOpen,
    onOpenChange,
    modal = true,
    allowPinchZoom,
  } = props;
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [open = false, setOpen] = useControllableState({
    prop: openProp,
    defaultProp: defaultOpen,
    onChange: onOpenChange,
  });

  return (
    <DialogProvider
      scope={__scopeDialog}
      triggerRef={triggerRef}
      contentId={useId()}
      titleId={useId()}
      descriptionId={useId()}
      open={open}
      onOpenChange={setOpen}
      onOpenToggle={React.useCallback(() => setOpen((prevOpen) => !prevOpen), [setOpen])}
      modal={modal}
      allowPinchZoom={allowPinchZoom}
    >
      {children}
    </DialogProvider>
  );
};

Dialog.displayName = DIALOG_NAME;

/* -------------------------------------------------------------------------------------------------
 * DialogTrigger
 * -----------------------------------------------------------------------------------------------*/

const TRIGGER_NAME = 'DialogTrigger';

type DialogTriggerElement = React.ElementRef<typeof Primitive.button>;
type PrimitiveButtonProps = Radix.ComponentPropsWithoutRef<typeof Primitive.button>;
interface DialogTriggerProps extends PrimitiveButtonProps {}

const DialogTrigger = React.forwardRef<DialogTriggerElement, DialogTriggerProps>(
  (props: ScopedProps<DialogTriggerProps>, forwardedRef) => {
    const { __scopeDialog, ...triggerProps } = props;
    const context = useDialogContext(TRIGGER_NAME, __scopeDialog);
    const composedTriggerRef = useComposedRefs(forwardedRef, context.triggerRef);
    return (
      <Primitive.button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={context.open}
        aria-controls={context.contentId}
        data-state={getState(context.open)}
        {...triggerProps}
        ref={composedTriggerRef}
        onClick={composeEventHandlers(props.onClick, context.onOpenToggle)}
      />
    );
  }
);

DialogTrigger.displayName = TRIGGER_NAME;

/* -------------------------------------------------------------------------------------------------
 * DialogPortal
 * -----------------------------------------------------------------------------------------------*/

const PORTAL_NAME = 'DialogPortal';

type PortalProps = React.ComponentPropsWithoutRef<typeof UnstablePortal>;
interface DialogPortalProps extends PortalProps {}

const DialogPortal: React.FC<DialogPortalProps> = (props: ScopedProps<DialogPortalProps>) => {
  const { __scopeDialog, ...portalProps } = props;
  const context = useDialogContext(PORTAL_NAME, __scopeDialog);
  return context.open ? <UnstablePortal {...portalProps} /> : null;
};

DialogPortal.displayName = PORTAL_NAME;

/* -------------------------------------------------------------------------------------------------
 * DialogOverlay
 * -----------------------------------------------------------------------------------------------*/

const OVERLAY_NAME = 'DialogOverlay';

type DialogOverlayElement = DialogOverlayImplElement;
interface DialogOverlayProps extends DialogOverlayImplProps {
  /**
   * Used to force mounting when more control is needed. Useful when
   * controlling animation with React animation libraries.
   */
  forceMount?: true;
}

const DialogOverlay = React.forwardRef<DialogOverlayElement, DialogOverlayProps>(
  (props: ScopedProps<DialogOverlayProps>, forwardedRef) => {
    const { forceMount, ...overlayProps } = props;
    const context = useDialogContext(OVERLAY_NAME, props.__scopeDialog);
    return context.modal ? (
      <Presence present={forceMount || context.open}>
        <DialogOverlayImpl {...overlayProps} ref={forwardedRef} />
      </Presence>
    ) : null;
  }
);

DialogOverlay.displayName = OVERLAY_NAME;

type DialogOverlayImplElement = React.ElementRef<typeof Primitive.div>;
type PrimitiveDivProps = Radix.ComponentPropsWithoutRef<typeof Primitive.div>;
interface DialogOverlayImplProps extends PrimitiveDivProps {}

const DialogOverlayImpl = React.forwardRef<DialogOverlayImplElement, DialogOverlayImplProps>(
  (props: ScopedProps<DialogOverlayImplProps>, forwardedRef) => {
    const { __scopeDialog, ...overlayProps } = props;
    const context = useDialogContext(OVERLAY_NAME, __scopeDialog);
    return (
      <RemoveScroll forwardProps allowPinchZoom={context.allowPinchZoom}>
        <Primitive.div
          data-state={getState(context.open)}
          {...overlayProps}
          ref={forwardedRef}
          // We re-enable pointer-events prevented by `Dialog.Content` to allow scrolling the overlay.
          style={{ pointerEvents: 'auto', ...overlayProps.style }}
        />
      </RemoveScroll>
    );
  }
);

/* -------------------------------------------------------------------------------------------------
 * DialogContent
 * -----------------------------------------------------------------------------------------------*/

const CONTENT_NAME = 'DialogContent';

type DialogContentElement = DialogContentTypeElement;
interface DialogContentProps extends DialogContentTypeProps {
  /**
   * Used to force mounting when more control is needed. Useful when
   * controlling animation with React animation libraries.
   */
  forceMount?: true;
}

const DialogContent = React.forwardRef<DialogContentElement, DialogContentProps>(
  (props: ScopedProps<DialogContentProps>, forwardedRef) => {
    const { forceMount, ...contentProps } = props;
    const context = useDialogContext(CONTENT_NAME, props.__scopeDialog);
    return (
      <Presence present={forceMount || context.open}>
        {context.modal ? (
          <DialogContentModal {...contentProps} ref={forwardedRef} />
        ) : (
          <DialogContentNonModal {...contentProps} ref={forwardedRef} />
        )}
      </Presence>
    );
  }
);

DialogContent.displayName = CONTENT_NAME;

/* -----------------------------------------------------------------------------------------------*/

type DialogContentTypeElement = DialogContentImplElement;
interface DialogContentTypeProps
  extends Omit<DialogContentImplProps, 'trapFocus' | 'disableOutsidePointerEvents'> {}

const DialogContentModal = React.forwardRef<DialogContentTypeElement, DialogContentTypeProps>(
  (props: ScopedProps<DialogContentTypeProps>, forwardedRef) => {
    const context = useDialogContext(CONTENT_NAME, props.__scopeDialog);
    const contentRef = React.useRef<HTMLDivElement>(null);
    const composedRefs = useComposedRefs(forwardedRef, contentRef);

    // aria-hide everything except the content (better supported equivalent to setting aria-modal)
    React.useEffect(() => {
      const content = contentRef.current;
      if (content) return hideOthers(content);
    }, []);

    return (
      <DialogContentImpl
        {...props}
        ref={composedRefs}
        // we make sure focus isn't trapped once `DialogContent` has been closed
        // (closed !== unmounted when animating out)
        trapFocus={context.open}
        disableOutsidePointerEvents
        onCloseAutoFocus={composeEventHandlers(props.onCloseAutoFocus, (event) => {
          event.preventDefault();
          context.triggerRef.current?.focus();
        })}
        onPointerDownOutside={composeEventHandlers(props.onPointerDownOutside, (event) => {
          const originalEvent = event.detail.originalEvent;
          const ctrlLeftClick = originalEvent.button === 0 && originalEvent.ctrlKey === true;
          const isRightClick = originalEvent.button === 2 || ctrlLeftClick;

          // If the event is a right-click, we shouldn't close because
          // it is effectively as if we right-clicked the `Overlay`.
          if (isRightClick) event.preventDefault();
        })}
        // When focus is trapped, a `focusout` event may still happen.
        // We make sure we don't trigger our `onDismiss` in such case.
        onFocusOutside={composeEventHandlers(props.onFocusOutside, (event) =>
          event.preventDefault()
        )}
      />
    );
  }
);

/* -----------------------------------------------------------------------------------------------*/

const DialogContentNonModal = React.forwardRef<DialogContentTypeElement, DialogContentTypeProps>(
  (props: ScopedProps<DialogContentTypeProps>, forwardedRef) => {
    const context = useDialogContext(CONTENT_NAME, props.__scopeDialog);
    const hasInteractedOutsideRef = React.useRef(false);

    return (
      <DialogContentImpl
        {...props}
        ref={forwardedRef}
        trapFocus={false}
        disableOutsidePointerEvents={false}
        onCloseAutoFocus={(event) => {
          props.onCloseAutoFocus?.(event);

          if (!event.defaultPrevented) {
            if (!hasInteractedOutsideRef.current) context.triggerRef.current?.focus();
            // Always prevent auto focus because we either focus manually or want user agent focus
            event.preventDefault();
          }

          hasInteractedOutsideRef.current = false;
        }}
        onInteractOutside={(event) => {
          props.onInteractOutside?.(event);

          if (!event.defaultPrevented) hasInteractedOutsideRef.current = true;

          // Prevent dismissing when clicking the trigger.
          // As the trigger is already setup to close, without doing so would
          // cause it to close and immediately open.
          //
          // We use `onInteractOutside` as some browsers also
          // focus on pointer down, creating the same issue.
          const target = event.target as HTMLElement;
          const targetIsTrigger = context.triggerRef.current?.contains(target);
          if (targetIsTrigger) event.preventDefault();
        }}
      />
    );
  }
);

/* -----------------------------------------------------------------------------------------------*/

type DialogContentImplElement = React.ElementRef<typeof DismissableLayer>;
type DismissableLayerProps = Radix.ComponentPropsWithoutRef<typeof DismissableLayer>;
type FocusScopeProps = Radix.ComponentPropsWithoutRef<typeof FocusScope>;
interface DialogContentImplProps extends Omit<DismissableLayerProps, 'onDismiss'> {
  /**
   * When `true`, focus cannot escape the `Content` via keyboard,
   * pointer, or a programmatic focus.
   * @defaultValue false
   */
  trapFocus?: FocusScopeProps['trapped'];

  /**
   * Event handler called when auto-focusing on open.
   * Can be prevented.
   */
  onOpenAutoFocus?: FocusScopeProps['onMountAutoFocus'];

  /**
   * Event handler called when auto-focusing on close.
   * Can be prevented.
   */
  onCloseAutoFocus?: FocusScopeProps['onUnmountAutoFocus'];
}

const DialogContentImpl = React.forwardRef<DialogContentImplElement, DialogContentImplProps>(
  (props: ScopedProps<DialogContentImplProps>, forwardedRef) => {
    const {
      __scopeDialog,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      'aria-describedby': ariaDescribedBy,
      trapFocus,
      onOpenAutoFocus,
      onCloseAutoFocus,
      ...contentProps
    } = props;
    const context = useDialogContext(CONTENT_NAME, __scopeDialog);
    const contentRef = React.useRef<HTMLDivElement>(null);
    const composedRefs = useComposedRefs(forwardedRef, contentRef);

    // Make sure the whole tree has focus guards as our `Dialog` will be
    // the last element in the DOM (beacuse of the `Portal`)
    useFocusGuards();

    return (
      <>
        <FocusScope
          asChild
          loop
          trapped={trapFocus}
          onMountAutoFocus={onOpenAutoFocus}
          onUnmountAutoFocus={onCloseAutoFocus}
        >
          <DismissableLayer
            role="dialog"
            id={context.contentId}
            aria-describedby={ariaDescribedBy || context.descriptionId}
            // If `aria-label` is set, ensure `aria-labelledby` is undefined as to avoid confusion.
            // Otherwise fallback to an explicit `aria-labelledby` or the ID used in the
            // `DialogTitle`
            aria-labelledby={ariaLabel ? undefined : ariaLabelledBy || context.titleId}
            aria-label={ariaLabel || undefined}
            data-state={getState(context.open)}
            {...contentProps}
            ref={composedRefs}
            onDismiss={() => context.onOpenChange(false)}
          />
        </FocusScope>
        {process.env.NODE_ENV === 'development' && <LabelWarning contentRef={contentRef} />}
      </>
    );
  }
);

/* -------------------------------------------------------------------------------------------------
 * DialogTitle
 * -----------------------------------------------------------------------------------------------*/

const TITLE_NAME = 'DialogTitle';

type DialogTitleElement = React.ElementRef<typeof Primitive.h2>;
type PrimitiveHeading2Props = Radix.ComponentPropsWithoutRef<typeof Primitive.h2>;
interface DialogTitleProps extends PrimitiveHeading2Props {}

const DialogTitle = React.forwardRef<DialogTitleElement, DialogTitleProps>(
  (props: ScopedProps<DialogTitleProps>, forwardedRef) => {
    const { __scopeDialog, ...titleProps } = props;
    const context = useDialogContext(TITLE_NAME, __scopeDialog);
    return <Primitive.h2 id={context.titleId} {...titleProps} ref={forwardedRef} />;
  }
);

DialogTitle.displayName = TITLE_NAME;

/* -------------------------------------------------------------------------------------------------
 * DialogDescription
 * -----------------------------------------------------------------------------------------------*/

const DESCRIPTION_NAME = 'DialogDescription';

type DialogDescriptionElement = React.ElementRef<typeof Primitive.p>;
type PrimitiveParagraphProps = Radix.ComponentPropsWithoutRef<typeof Primitive.p>;
interface DialogDescriptionProps extends PrimitiveParagraphProps {}

const DialogDescription = React.forwardRef<DialogDescriptionElement, DialogDescriptionProps>(
  (props: ScopedProps<DialogDescriptionProps>, forwardedRef) => {
    const { __scopeDialog, ...descriptionProps } = props;
    const context = useDialogContext(DESCRIPTION_NAME, __scopeDialog);
    return <Primitive.p id={context.descriptionId} {...descriptionProps} ref={forwardedRef} />;
  }
);

DialogDescription.displayName = DESCRIPTION_NAME;

/* -------------------------------------------------------------------------------------------------
 * DialogClose
 * -----------------------------------------------------------------------------------------------*/

const CLOSE_NAME = 'DialogClose';

type DialogCloseElement = React.ElementRef<typeof Primitive.button>;
interface DialogCloseProps extends PrimitiveButtonProps {}

const DialogClose = React.forwardRef<DialogCloseElement, DialogCloseProps>(
  (props: ScopedProps<DialogCloseProps>, forwardedRef) => {
    const { __scopeDialog, ...closeProps } = props;
    const context = useDialogContext(CLOSE_NAME, __scopeDialog);
    return (
      <Primitive.button
        type="button"
        {...closeProps}
        ref={forwardedRef}
        onClick={composeEventHandlers(props.onClick, () => context.onOpenChange(false))}
      />
    );
  }
);

DialogClose.displayName = CLOSE_NAME;

/* -----------------------------------------------------------------------------------------------*/

function getState(open: boolean) {
  return open ? 'open' : 'closed';
}

const LABEL_WARNING_NAME = 'DialogLabelWarning';

const [LabelWarningProvider, useLabelWarningContext] = createContext(LABEL_WARNING_NAME, {
  contentName: CONTENT_NAME,
  titleName: TITLE_NAME,
  docsSlug: 'dialog',
});

type LabelWarningProps = {
  contentRef: React.RefObject<DialogContentElement>;
};

const LabelWarning: React.FC<LabelWarningProps> = ({ contentRef }) => {
  const labelWarningContext = useLabelWarningContext(LABEL_WARNING_NAME);

  const MESSAGE = `\`${labelWarningContext.contentName}\` requires a label for the component to be accessible for screen reader users.

You can label the \`${labelWarningContext.contentName}\` by passing a \`${labelWarningContext.titleName}\` component as a child, which also benefits sighted users by adding visible context to the dialog.

Alternatively, you can use your own component as a title by assigning it an \`id\` and passing the same value to the \`aria-labelledby\` prop in \`${labelWarningContext.contentName}\`. If the label is confusing or duplicative for sighted users, you can also pass a label directly by using the \`aria-label\` prop.

For more information, see https://radix-ui.com/primitives/docs/components/${labelWarningContext.docsSlug}`;

  React.useEffect(() => {
    const hasLabel =
      contentRef.current?.getAttribute('aria-label') ||
      document.getElementById(contentRef.current?.getAttribute('aria-labelledby')!);

    if (!hasLabel) console.warn(MESSAGE);
  }, [MESSAGE, contentRef]);

  return null;
};

const Root = Dialog;
const Trigger = DialogTrigger;
const Portal = DialogPortal;
const Overlay = DialogOverlay;
const Content = DialogContent;
const Title = DialogTitle;
const Description = DialogDescription;
const Close = DialogClose;

export {
  createDialogScope,
  //
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
  //
  Root,
  Trigger,
  Portal,
  Overlay,
  Content,
  Title,
  Description,
  Close,
  //
  LabelWarningProvider,
};
export type {
  DialogProps,
  DialogTriggerProps,
  DialogPortalProps,
  DialogOverlayProps,
  DialogContentProps,
  DialogTitleProps,
  DialogDescriptionProps,
  DialogCloseProps,
};
