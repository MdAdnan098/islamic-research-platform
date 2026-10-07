const SRC = "https://checkout.razorpay.com/v1/checkout.js";
let pending = null;

/** Loads Razorpay's hosted checkout script on demand (only when someone actually clicks Enroll). */
export function loadRazorpay() {
  if (typeof window !== "undefined" && window.Razorpay) return Promise.resolve(window.Razorpay);
  if (pending) return pending;
  pending = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SRC;
    script.async = true;
    script.onload = () => (window.Razorpay ? resolve(window.Razorpay) : reject(new Error("Payment window failed to load.")));
    script.onerror = () => reject(new Error("Could not load the payment window. Check your connection and try again."));
    document.head.appendChild(script);
  }).catch((e) => { pending = null; throw e; });
  return pending;
}
