import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@prisma/client";
import { Pool } from "pg";

interface SeedCategory {
  slug: string;
  name: string;
  sortOrder: number;
}

interface SeedProduct {
  slug: string;
  name: string;
  description: string;
  categorySlug: string;
  basePriceMinor: number;
  sortOrder: number;
}

interface SeedProductOption {
  id: string;
  name: string;
  priceDeltaMinor: number;
  sortOrder: number;
}

interface SeedProductOptionGroup {
  id: string;
  productSlug: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  sortOrder: number;
  options: readonly SeedProductOption[];
}

export const restaurantCategories: readonly SeedCategory[] = [
  { slug: "executivos", name: "Executivos", sortOrder: 10 },
  { slug: "bebidas", name: "Bebidas", sortOrder: 20 },
  { slug: "acompanhamentos", name: "Acompanhamentos", sortOrder: 30 },
];

export const restaurantProducts: readonly SeedProduct[] = [
  {
    slug: "bife-acebolado",
    name: "Bife acebolado",
    description: "Bife bovino grelhado com cebola, arroz, feijão e salada do dia.",
    categorySlug: "executivos",
    basePriceMinor: 3290,
    sortOrder: 10,
  },
  {
    slug: "frango-grelhado",
    name: "Frango grelhado",
    description: "Filé de frango grelhado acompanhado de arroz, feijão e salada do dia.",
    categorySlug: "executivos",
    basePriceMinor: 2890,
    sortOrder: 20,
  },
  {
    slug: "frango-a-parmegiana",
    name: "Frango à parmegiana",
    description: "Filé de frango empanado com molho de tomate e queijo, arroz e batata frita.",
    categorySlug: "executivos",
    basePriceMinor: 3490,
    sortOrder: 30,
  },
  {
    slug: "feijoada-executiva",
    name: "Feijoada executiva",
    description: "Feijoada com arroz branco, couve refogada, farofa e laranja.",
    categorySlug: "executivos",
    basePriceMinor: 3690,
    sortOrder: 40,
  },
  {
    slug: "carne-de-panela",
    name: "Carne de panela",
    description: "Carne bovina cozida com legumes, arroz branco e feijão.",
    categorySlug: "executivos",
    basePriceMinor: 3190,
    sortOrder: 50,
  },
  {
    slug: "coca-cola-lata-350ml",
    name: "Coca-Cola lata 350 ml",
    description: "Refrigerante Coca-Cola gelado em lata de 350 ml.",
    categorySlug: "bebidas",
    basePriceMinor: 700,
    sortOrder: 10,
  },
  {
    slug: "guarana-antarctica-lata-350ml",
    name: "Guaraná Antarctica lata 350 ml",
    description: "Refrigerante de guaraná gelado em lata de 350 ml.",
    categorySlug: "bebidas",
    basePriceMinor: 650,
    sortOrder: 20,
  },
  {
    slug: "suco-de-laranja-500ml",
    name: "Suco de laranja 500 ml",
    description: "Suco natural de laranja preparado na hora, sem conservantes.",
    categorySlug: "bebidas",
    basePriceMinor: 1200,
    sortOrder: 30,
  },
  {
    slug: "agua-mineral-sem-gas-500ml",
    name: "Água mineral sem gás 500 ml",
    description: "Garrafa de água mineral sem gás, servida gelada.",
    categorySlug: "bebidas",
    basePriceMinor: 450,
    sortOrder: 40,
  },
  {
    slug: "agua-mineral-com-gas-500ml",
    name: "Água mineral com gás 500 ml",
    description: "Garrafa de água mineral com gás, servida gelada.",
    categorySlug: "bebidas",
    basePriceMinor: 550,
    sortOrder: 50,
  },
  {
    slug: "porcao-de-arroz",
    name: "Porção de arroz",
    description: "Porção individual de arroz branco soltinho.",
    categorySlug: "acompanhamentos",
    basePriceMinor: 700,
    sortOrder: 10,
  },
  {
    slug: "porcao-de-feijao",
    name: "Porção de feijão",
    description: "Porção individual de feijão caseiro temperado.",
    categorySlug: "acompanhamentos",
    basePriceMinor: 800,
    sortOrder: 20,
  },
  {
    slug: "batata-frita",
    name: "Batata frita",
    description: "Porção de batatas fritas crocantes e sequinhas.",
    categorySlug: "acompanhamentos",
    basePriceMinor: 1490,
    sortOrder: 30,
  },
  {
    slug: "salada-da-casa",
    name: "Salada da casa",
    description: "Alface, tomate, cebola e cenoura com molho servido à parte.",
    categorySlug: "acompanhamentos",
    basePriceMinor: 990,
    sortOrder: 40,
  },
  {
    slug: "farofa-temperada",
    name: "Farofa temperada",
    description: "Porção de farofa crocante preparada com temperos da casa.",
    categorySlug: "acompanhamentos",
    basePriceMinor: 650,
    sortOrder: 50,
  },
];

const executiveProductSlugs = [
  "bife-acebolado",
  "frango-grelhado",
  "frango-a-parmegiana",
  "feijoada-executiva",
  "carne-de-panela",
] as const;

const executiveOptionGroups: SeedProductOptionGroup[] = executiveProductSlugs.flatMap((productSlug) => [
  {
    id: `seed-pog-${productSlug}-acompanhamentos`,
    productSlug,
    name: "Escolha 2 acompanhamentos",
    minSelections: 2,
    maxSelections: 2,
    sortOrder: 10,
    options: [
      { id: `seed-po-${productSlug}-arroz`, name: "Arroz branco", priceDeltaMinor: 0, sortOrder: 10 },
      { id: `seed-po-${productSlug}-feijao`, name: "Feijão", priceDeltaMinor: 0, sortOrder: 20 },
      { id: `seed-po-${productSlug}-salada`, name: "Salada do dia", priceDeltaMinor: 0, sortOrder: 30 },
      { id: `seed-po-${productSlug}-fritas`, name: "Batata frita", priceDeltaMinor: 300, sortOrder: 40 },
    ],
  },
  {
    id: `seed-pog-${productSlug}-adicionais`,
    productSlug,
    name: "Adicionais",
    minSelections: 0,
    maxSelections: 3,
    sortOrder: 20,
    options: [
      { id: `seed-po-${productSlug}-ovo`, name: "Ovo frito", priceDeltaMinor: 350, sortOrder: 10 },
      { id: `seed-po-${productSlug}-queijo`, name: "Queijo", priceDeltaMinor: 400, sortOrder: 20 },
      { id: `seed-po-${productSlug}-bacon`, name: "Bacon", priceDeltaMinor: 500, sortOrder: 30 },
      { id: `seed-po-${productSlug}-farofa`, name: "Farofa", priceDeltaMinor: 300, sortOrder: 40 },
    ],
  },
]);

const temperatureProductSlugs = [
  "coca-cola-lata-350ml",
  "guarana-antarctica-lata-350ml",
  "agua-mineral-sem-gas-500ml",
  "agua-mineral-com-gas-500ml",
] as const;

const drinkOptionGroups: SeedProductOptionGroup[] = [
  ...temperatureProductSlugs.map((productSlug) => ({
    id: `seed-pog-${productSlug}-temperatura`,
    productSlug,
    name: "Temperatura",
    minSelections: 1,
    maxSelections: 1,
    sortOrder: 10,
    options: [
      { id: `seed-po-${productSlug}-gelada`, name: "Gelada", priceDeltaMinor: 0, sortOrder: 10 },
      { id: `seed-po-${productSlug}-natural`, name: "Natural", priceDeltaMinor: 0, sortOrder: 20 },
    ],
  })),
  {
    id: "seed-pog-suco-de-laranja-500ml-adocar",
    productSlug: "suco-de-laranja-500ml",
    name: "Como deseja adoçar?",
    minSelections: 1,
    maxSelections: 1,
    sortOrder: 10,
    options: [
      { id: "seed-po-suco-de-laranja-500ml-sem-acucar", name: "Sem açúcar", priceDeltaMinor: 0, sortOrder: 10 },
      { id: "seed-po-suco-de-laranja-500ml-acucar", name: "Com açúcar", priceDeltaMinor: 0, sortOrder: 20 },
      { id: "seed-po-suco-de-laranja-500ml-adocante", name: "Com adoçante", priceDeltaMinor: 0, sortOrder: 30 },
    ],
  },
];

const sideProductSlugs = [
  "porcao-de-arroz",
  "porcao-de-feijao",
  "batata-frita",
  "salada-da-casa",
  "farofa-temperada",
] as const;

const sideOptionGroups: SeedProductOptionGroup[] = sideProductSlugs.map((productSlug) => ({
  id: `seed-pog-${productSlug}-tamanho`,
  productSlug,
  name: "Tamanho da porção",
  minSelections: 1,
  maxSelections: 1,
  sortOrder: 10,
  options: [
    { id: `seed-po-${productSlug}-tradicional`, name: "Tradicional", priceDeltaMinor: 0, sortOrder: 10 },
    { id: `seed-po-${productSlug}-grande`, name: "Grande", priceDeltaMinor: 600, sortOrder: 20 },
  ],
}));

export const restaurantProductOptionGroups: readonly SeedProductOptionGroup[] = [
  ...executiveOptionGroups,
  {
    id: "seed-pog-bife-acebolado-ponto",
    productSlug: "bife-acebolado",
    name: "Ponto da carne",
    minSelections: 1,
    maxSelections: 1,
    sortOrder: 30,
    options: [
      { id: "seed-po-bife-acebolado-mal-passado", name: "Mal passada", priceDeltaMinor: 0, sortOrder: 10 },
      { id: "seed-po-bife-acebolado-ao-ponto", name: "Ao ponto", priceDeltaMinor: 0, sortOrder: 20 },
      { id: "seed-po-bife-acebolado-bem-passado", name: "Bem passada", priceDeltaMinor: 0, sortOrder: 30 },
    ],
  },
  ...drinkOptionGroups,
  ...sideOptionGroups,
];

export async function seedRestaurantProducts(client: PrismaClient): Promise<void> {
  await client.$transaction(async (transaction: Prisma.TransactionClient) => {
    for (const category of restaurantCategories) {
      await transaction.category.upsert({
        where: { slug: category.slug },
        create: category,
        update: { name: category.name, sortOrder: category.sortOrder },
      });
    }

    for (const product of restaurantProducts) {
      const { categorySlug, ...data } = product;
      await transaction.product.upsert({
        where: { slug: product.slug },
        create: {
          ...data,
          currency: "BRL",
          available: true,
          category: { connect: { slug: categorySlug } },
        },
        update: {
          name: data.name,
          description: data.description,
          basePriceMinor: data.basePriceMinor,
          currency: "BRL",
          available: true,
          sortOrder: data.sortOrder,
          category: { connect: { slug: categorySlug } },
        },
      });
    }

    for (const group of restaurantProductOptionGroups) {
      await transaction.productOptionGroup.upsert({
        where: { id: group.id },
        create: {
          id: group.id,
          name: group.name,
          minSelections: group.minSelections,
          maxSelections: group.maxSelections,
          sortOrder: group.sortOrder,
          product: { connect: { slug: group.productSlug } },
        },
        update: {
          name: group.name,
          minSelections: group.minSelections,
          maxSelections: group.maxSelections,
          sortOrder: group.sortOrder,
          product: { connect: { slug: group.productSlug } },
        },
      });

      for (const option of group.options) {
        await transaction.productOption.upsert({
          where: { id: option.id },
          create: {
            ...option,
            available: true,
            group: { connect: { id: group.id } },
          },
          update: {
            name: option.name,
            priceDeltaMinor: option.priceDeltaMinor,
            available: true,
            sortOrder: option.sortOrder,
            group: { connect: { id: group.id } },
          },
        });
      }
    }

    await transaction.catalogRevision.upsert({
      where: { id: "main" },
      create: { id: "main", version: 1 },
      update: { version: { increment: 1 } },
    });
  });
}

async function main(): Promise<void> {
  const connectionString = process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"];
  if (!connectionString) throw new Error("DIRECT_URL or DATABASE_URL is required to seed the catalog");

  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 10_000 });
  const client = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    await seedRestaurantProducts(client);
    const optionCount = restaurantProductOptionGroups.reduce((total, group) => total + group.options.length, 0);
    console.log(
      `Seed completed: ${restaurantCategories.length} categories, ${restaurantProducts.length} products, ` +
      `${restaurantProductOptionGroups.length} option groups, and ${optionCount} options.`,
    );
  } finally {
    await client.$disconnect();
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error("Restaurant catalog seed failed", error instanceof Error ? error.message : "Unknown error");
    process.exitCode = 1;
  });
}
