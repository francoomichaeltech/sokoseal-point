import { redirect } from "next/navigation";

// Shop setup check is added with the catalogue; until then, go straight to products.
export default function Home() {
  redirect("/products");
}