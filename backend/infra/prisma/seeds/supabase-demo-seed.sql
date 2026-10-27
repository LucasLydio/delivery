-- Run only after all Prisma migrations have been applied.
-- This seed is idempotent and targets the public schema created by Prisma.

BEGIN;

SET LOCAL statement_timeout = '120s';
SET LOCAL lock_timeout = '10s';

INSERT INTO "categories" (
  "id", "slug", "name", "sort_order", "created_at", "updated_at"
)
VALUES
  ('seed-category-executivos', 'executivos', 'Executivos', 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed-category-bebidas', 'bebidas', 'Bebidas', 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed-category-acompanhamentos', 'acompanhamentos', 'Acompanhamentos', 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "sort_order" = EXCLUDED."sort_order",
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "products" (
  "id", "slug", "name", "description", "category_id",
  "base_price_minor", "currency", "available", "sort_order",
  "created_at", "updated_at"
)
SELECT
  seed."id",
  seed."slug",
  seed."name",
  seed."description",
  category."id",
  seed."base_price_minor",
  'BRL',
  TRUE,
  seed."sort_order",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (VALUES
  ('seed-product-bife-acebolado', 'bife-acebolado', 'Bife acebolado', 'Bife bovino grelhado com cebola, arroz, feijão e salada do dia.', 'executivos', 3290, 10),
  ('seed-product-frango-grelhado', 'frango-grelhado', 'Frango grelhado', 'Filé de frango grelhado acompanhado de arroz, feijão e salada do dia.', 'executivos', 2890, 20),
  ('seed-product-frango-a-parmegiana', 'frango-a-parmegiana', 'Frango à parmegiana', 'Filé de frango empanado com molho de tomate e queijo, arroz e batata frita.', 'executivos', 3490, 30),
  ('seed-product-feijoada-executiva', 'feijoada-executiva', 'Feijoada executiva', 'Feijoada com arroz branco, couve refogada, farofa e laranja.', 'executivos', 3690, 40),
  ('seed-product-carne-de-panela', 'carne-de-panela', 'Carne de panela', 'Carne bovina cozida com legumes, arroz branco e feijão.', 'executivos', 3190, 50),
  ('seed-product-coca-cola-lata-350ml', 'coca-cola-lata-350ml', 'Coca-Cola lata 350 ml', 'Refrigerante Coca-Cola gelado em lata de 350 ml.', 'bebidas', 700, 10),
  ('seed-product-guarana-antarctica-lata-350ml', 'guarana-antarctica-lata-350ml', 'Guaraná Antarctica lata 350 ml', 'Refrigerante de guaraná gelado em lata de 350 ml.', 'bebidas', 650, 20),
  ('seed-product-suco-de-laranja-500ml', 'suco-de-laranja-500ml', 'Suco de laranja 500 ml', 'Suco natural de laranja preparado na hora, sem conservantes.', 'bebidas', 1200, 30),
  ('seed-product-agua-mineral-sem-gas-500ml', 'agua-mineral-sem-gas-500ml', 'Água mineral sem gás 500 ml', 'Garrafa de água mineral sem gás, servida gelada.', 'bebidas', 450, 40),
  ('seed-product-agua-mineral-com-gas-500ml', 'agua-mineral-com-gas-500ml', 'Água mineral com gás 500 ml', 'Garrafa de água mineral com gás, servida gelada.', 'bebidas', 550, 50),
  ('seed-product-porcao-de-arroz', 'porcao-de-arroz', 'Porção de arroz', 'Porção individual de arroz branco soltinho.', 'acompanhamentos', 700, 10),
  ('seed-product-porcao-de-feijao', 'porcao-de-feijao', 'Porção de feijão', 'Porção individual de feijão caseiro temperado.', 'acompanhamentos', 800, 20),
  ('seed-product-batata-frita', 'batata-frita', 'Batata frita', 'Porção de batatas fritas crocantes e sequinhas.', 'acompanhamentos', 1490, 30),
  ('seed-product-salada-da-casa', 'salada-da-casa', 'Salada da casa', 'Alface, tomate, cebola e cenoura com molho servido à parte.', 'acompanhamentos', 990, 40),
  ('seed-product-farofa-temperada', 'farofa-temperada', 'Farofa temperada', 'Porção de farofa crocante preparada com temperos da casa.', 'acompanhamentos', 650, 50)
) AS seed("id", "slug", "name", "description", "category_slug", "base_price_minor", "sort_order")
JOIN "categories" AS category ON category."slug" = seed."category_slug"
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "category_id" = EXCLUDED."category_id",
  "base_price_minor" = EXCLUDED."base_price_minor",
  "currency" = EXCLUDED."currency",
  "available" = EXCLUDED."available",
  "sort_order" = EXCLUDED."sort_order",
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "product_option_groups" (
  "id", "product_id", "name", "min_selections", "max_selections", "sort_order"
)
SELECT
  seed."id",
  product."id",
  seed."name",
  seed."min_selections",
  seed."max_selections",
  seed."sort_order"
FROM (VALUES
  ('seed-pog-bife-acebolado-acompanhamentos', 'bife-acebolado', 'Escolha 2 acompanhamentos', 2, 2, 10),
  ('seed-pog-bife-acebolado-adicionais', 'bife-acebolado', 'Adicionais', 0, 3, 20),
  ('seed-pog-frango-grelhado-acompanhamentos', 'frango-grelhado', 'Escolha 2 acompanhamentos', 2, 2, 10),
  ('seed-pog-frango-grelhado-adicionais', 'frango-grelhado', 'Adicionais', 0, 3, 20),
  ('seed-pog-frango-a-parmegiana-acompanhamentos', 'frango-a-parmegiana', 'Escolha 2 acompanhamentos', 2, 2, 10),
  ('seed-pog-frango-a-parmegiana-adicionais', 'frango-a-parmegiana', 'Adicionais', 0, 3, 20),
  ('seed-pog-feijoada-executiva-acompanhamentos', 'feijoada-executiva', 'Escolha 2 acompanhamentos', 2, 2, 10),
  ('seed-pog-feijoada-executiva-adicionais', 'feijoada-executiva', 'Adicionais', 0, 3, 20),
  ('seed-pog-carne-de-panela-acompanhamentos', 'carne-de-panela', 'Escolha 2 acompanhamentos', 2, 2, 10),
  ('seed-pog-carne-de-panela-adicionais', 'carne-de-panela', 'Adicionais', 0, 3, 20),
  ('seed-pog-bife-acebolado-ponto', 'bife-acebolado', 'Ponto da carne', 1, 1, 30),
  ('seed-pog-coca-cola-lata-350ml-temperatura', 'coca-cola-lata-350ml', 'Temperatura', 1, 1, 10),
  ('seed-pog-guarana-antarctica-lata-350ml-temperatura', 'guarana-antarctica-lata-350ml', 'Temperatura', 1, 1, 10),
  ('seed-pog-agua-mineral-sem-gas-500ml-temperatura', 'agua-mineral-sem-gas-500ml', 'Temperatura', 1, 1, 10),
  ('seed-pog-agua-mineral-com-gas-500ml-temperatura', 'agua-mineral-com-gas-500ml', 'Temperatura', 1, 1, 10),
  ('seed-pog-suco-de-laranja-500ml-adocar', 'suco-de-laranja-500ml', 'Como deseja adoçar?', 1, 1, 10),
  ('seed-pog-porcao-de-arroz-tamanho', 'porcao-de-arroz', 'Tamanho da porção', 1, 1, 10),
  ('seed-pog-porcao-de-feijao-tamanho', 'porcao-de-feijao', 'Tamanho da porção', 1, 1, 10),
  ('seed-pog-batata-frita-tamanho', 'batata-frita', 'Tamanho da porção', 1, 1, 10),
  ('seed-pog-salada-da-casa-tamanho', 'salada-da-casa', 'Tamanho da porção', 1, 1, 10),
  ('seed-pog-farofa-temperada-tamanho', 'farofa-temperada', 'Tamanho da porção', 1, 1, 10)
) AS seed("id", "product_slug", "name", "min_selections", "max_selections", "sort_order")
JOIN "products" AS product ON product."slug" = seed."product_slug"
ON CONFLICT ("id") DO UPDATE SET
  "product_id" = EXCLUDED."product_id",
  "name" = EXCLUDED."name",
  "min_selections" = EXCLUDED."min_selections",
  "max_selections" = EXCLUDED."max_selections",
  "sort_order" = EXCLUDED."sort_order";

INSERT INTO "product_options" (
  "id", "group_id", "name", "price_delta_minor", "available", "sort_order"
)
VALUES
  ('seed-po-bife-acebolado-arroz', 'seed-pog-bife-acebolado-acompanhamentos', 'Arroz branco', 0, TRUE, 10),
  ('seed-po-bife-acebolado-feijao', 'seed-pog-bife-acebolado-acompanhamentos', 'Feijão', 0, TRUE, 20),
  ('seed-po-bife-acebolado-salada', 'seed-pog-bife-acebolado-acompanhamentos', 'Salada do dia', 0, TRUE, 30),
  ('seed-po-bife-acebolado-fritas', 'seed-pog-bife-acebolado-acompanhamentos', 'Batata frita', 300, TRUE, 40),
  ('seed-po-bife-acebolado-ovo', 'seed-pog-bife-acebolado-adicionais', 'Ovo frito', 350, TRUE, 10),
  ('seed-po-bife-acebolado-queijo', 'seed-pog-bife-acebolado-adicionais', 'Queijo', 400, TRUE, 20),
  ('seed-po-bife-acebolado-bacon', 'seed-pog-bife-acebolado-adicionais', 'Bacon', 500, TRUE, 30),
  ('seed-po-bife-acebolado-farofa', 'seed-pog-bife-acebolado-adicionais', 'Farofa', 300, TRUE, 40),
  ('seed-po-frango-grelhado-arroz', 'seed-pog-frango-grelhado-acompanhamentos', 'Arroz branco', 0, TRUE, 10),
  ('seed-po-frango-grelhado-feijao', 'seed-pog-frango-grelhado-acompanhamentos', 'Feijão', 0, TRUE, 20),
  ('seed-po-frango-grelhado-salada', 'seed-pog-frango-grelhado-acompanhamentos', 'Salada do dia', 0, TRUE, 30),
  ('seed-po-frango-grelhado-fritas', 'seed-pog-frango-grelhado-acompanhamentos', 'Batata frita', 300, TRUE, 40),
  ('seed-po-frango-grelhado-ovo', 'seed-pog-frango-grelhado-adicionais', 'Ovo frito', 350, TRUE, 10),
  ('seed-po-frango-grelhado-queijo', 'seed-pog-frango-grelhado-adicionais', 'Queijo', 400, TRUE, 20),
  ('seed-po-frango-grelhado-bacon', 'seed-pog-frango-grelhado-adicionais', 'Bacon', 500, TRUE, 30),
  ('seed-po-frango-grelhado-farofa', 'seed-pog-frango-grelhado-adicionais', 'Farofa', 300, TRUE, 40),
  ('seed-po-frango-a-parmegiana-arroz', 'seed-pog-frango-a-parmegiana-acompanhamentos', 'Arroz branco', 0, TRUE, 10),
  ('seed-po-frango-a-parmegiana-feijao', 'seed-pog-frango-a-parmegiana-acompanhamentos', 'Feijão', 0, TRUE, 20),
  ('seed-po-frango-a-parmegiana-salada', 'seed-pog-frango-a-parmegiana-acompanhamentos', 'Salada do dia', 0, TRUE, 30),
  ('seed-po-frango-a-parmegiana-fritas', 'seed-pog-frango-a-parmegiana-acompanhamentos', 'Batata frita', 300, TRUE, 40),
  ('seed-po-frango-a-parmegiana-ovo', 'seed-pog-frango-a-parmegiana-adicionais', 'Ovo frito', 350, TRUE, 10),
  ('seed-po-frango-a-parmegiana-queijo', 'seed-pog-frango-a-parmegiana-adicionais', 'Queijo', 400, TRUE, 20),
  ('seed-po-frango-a-parmegiana-bacon', 'seed-pog-frango-a-parmegiana-adicionais', 'Bacon', 500, TRUE, 30),
  ('seed-po-frango-a-parmegiana-farofa', 'seed-pog-frango-a-parmegiana-adicionais', 'Farofa', 300, TRUE, 40),
  ('seed-po-feijoada-executiva-arroz', 'seed-pog-feijoada-executiva-acompanhamentos', 'Arroz branco', 0, TRUE, 10),
  ('seed-po-feijoada-executiva-feijao', 'seed-pog-feijoada-executiva-acompanhamentos', 'Feijão', 0, TRUE, 20),
  ('seed-po-feijoada-executiva-salada', 'seed-pog-feijoada-executiva-acompanhamentos', 'Salada do dia', 0, TRUE, 30),
  ('seed-po-feijoada-executiva-fritas', 'seed-pog-feijoada-executiva-acompanhamentos', 'Batata frita', 300, TRUE, 40),
  ('seed-po-feijoada-executiva-ovo', 'seed-pog-feijoada-executiva-adicionais', 'Ovo frito', 350, TRUE, 10),
  ('seed-po-feijoada-executiva-queijo', 'seed-pog-feijoada-executiva-adicionais', 'Queijo', 400, TRUE, 20),
  ('seed-po-feijoada-executiva-bacon', 'seed-pog-feijoada-executiva-adicionais', 'Bacon', 500, TRUE, 30),
  ('seed-po-feijoada-executiva-farofa', 'seed-pog-feijoada-executiva-adicionais', 'Farofa', 300, TRUE, 40),
  ('seed-po-carne-de-panela-arroz', 'seed-pog-carne-de-panela-acompanhamentos', 'Arroz branco', 0, TRUE, 10),
  ('seed-po-carne-de-panela-feijao', 'seed-pog-carne-de-panela-acompanhamentos', 'Feijão', 0, TRUE, 20),
  ('seed-po-carne-de-panela-salada', 'seed-pog-carne-de-panela-acompanhamentos', 'Salada do dia', 0, TRUE, 30),
  ('seed-po-carne-de-panela-fritas', 'seed-pog-carne-de-panela-acompanhamentos', 'Batata frita', 300, TRUE, 40),
  ('seed-po-carne-de-panela-ovo', 'seed-pog-carne-de-panela-adicionais', 'Ovo frito', 350, TRUE, 10),
  ('seed-po-carne-de-panela-queijo', 'seed-pog-carne-de-panela-adicionais', 'Queijo', 400, TRUE, 20),
  ('seed-po-carne-de-panela-bacon', 'seed-pog-carne-de-panela-adicionais', 'Bacon', 500, TRUE, 30),
  ('seed-po-carne-de-panela-farofa', 'seed-pog-carne-de-panela-adicionais', 'Farofa', 300, TRUE, 40),
  ('seed-po-bife-acebolado-mal-passado', 'seed-pog-bife-acebolado-ponto', 'Mal passada', 0, TRUE, 10),
  ('seed-po-bife-acebolado-ao-ponto', 'seed-pog-bife-acebolado-ponto', 'Ao ponto', 0, TRUE, 20),
  ('seed-po-bife-acebolado-bem-passado', 'seed-pog-bife-acebolado-ponto', 'Bem passada', 0, TRUE, 30),
  ('seed-po-coca-cola-lata-350ml-gelada', 'seed-pog-coca-cola-lata-350ml-temperatura', 'Gelada', 0, TRUE, 10),
  ('seed-po-coca-cola-lata-350ml-natural', 'seed-pog-coca-cola-lata-350ml-temperatura', 'Natural', 0, TRUE, 20),
  ('seed-po-guarana-antarctica-lata-350ml-gelada', 'seed-pog-guarana-antarctica-lata-350ml-temperatura', 'Gelada', 0, TRUE, 10),
  ('seed-po-guarana-antarctica-lata-350ml-natural', 'seed-pog-guarana-antarctica-lata-350ml-temperatura', 'Natural', 0, TRUE, 20),
  ('seed-po-agua-mineral-sem-gas-500ml-gelada', 'seed-pog-agua-mineral-sem-gas-500ml-temperatura', 'Gelada', 0, TRUE, 10),
  ('seed-po-agua-mineral-sem-gas-500ml-natural', 'seed-pog-agua-mineral-sem-gas-500ml-temperatura', 'Natural', 0, TRUE, 20),
  ('seed-po-agua-mineral-com-gas-500ml-gelada', 'seed-pog-agua-mineral-com-gas-500ml-temperatura', 'Gelada', 0, TRUE, 10),
  ('seed-po-agua-mineral-com-gas-500ml-natural', 'seed-pog-agua-mineral-com-gas-500ml-temperatura', 'Natural', 0, TRUE, 20),
  ('seed-po-suco-de-laranja-500ml-sem-acucar', 'seed-pog-suco-de-laranja-500ml-adocar', 'Sem açúcar', 0, TRUE, 10),
  ('seed-po-suco-de-laranja-500ml-acucar', 'seed-pog-suco-de-laranja-500ml-adocar', 'Com açúcar', 0, TRUE, 20),
  ('seed-po-suco-de-laranja-500ml-adocante', 'seed-pog-suco-de-laranja-500ml-adocar', 'Com adoçante', 0, TRUE, 30),
  ('seed-po-porcao-de-arroz-tradicional', 'seed-pog-porcao-de-arroz-tamanho', 'Tradicional', 0, TRUE, 10),
  ('seed-po-porcao-de-arroz-grande', 'seed-pog-porcao-de-arroz-tamanho', 'Grande', 600, TRUE, 20),
  ('seed-po-porcao-de-feijao-tradicional', 'seed-pog-porcao-de-feijao-tamanho', 'Tradicional', 0, TRUE, 10),
  ('seed-po-porcao-de-feijao-grande', 'seed-pog-porcao-de-feijao-tamanho', 'Grande', 600, TRUE, 20),
  ('seed-po-batata-frita-tradicional', 'seed-pog-batata-frita-tamanho', 'Tradicional', 0, TRUE, 10),
  ('seed-po-batata-frita-grande', 'seed-pog-batata-frita-tamanho', 'Grande', 600, TRUE, 20),
  ('seed-po-salada-da-casa-tradicional', 'seed-pog-salada-da-casa-tamanho', 'Tradicional', 0, TRUE, 10),
  ('seed-po-salada-da-casa-grande', 'seed-pog-salada-da-casa-tamanho', 'Grande', 600, TRUE, 20),
  ('seed-po-farofa-temperada-tradicional', 'seed-pog-farofa-temperada-tamanho', 'Tradicional', 0, TRUE, 10),
  ('seed-po-farofa-temperada-grande', 'seed-pog-farofa-temperada-tamanho', 'Grande', 600, TRUE, 20)
ON CONFLICT ("id") DO UPDATE SET
  "group_id" = EXCLUDED."group_id",
  "name" = EXCLUDED."name",
  "price_delta_minor" = EXCLUDED."price_delta_minor",
  "available" = EXCLUDED."available",
  "sort_order" = EXCLUDED."sort_order";

INSERT INTO "users" (
  "id", "name", "email", "profile", "password_hash", "created_at", "updated_at"
)
VALUES
  (
    'seed-user-admin',
    'Administrador Demonstração',
    'admin@demonstracao.com.br',
    'ADMIN'::"UserProfile",
    'scrypt$16384$8$1$f42TDrWCKQQxiQgX0UgVjA$u0N3P1EVX1fctM8iUTsAxjWZ6BtYSwDc5qUVmMtEtGLmLPJpJaBUu2vS0LPk7JumKZdk4eQewD81EIQxl09xsA',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'seed-user-manager',
    'Gerente Demonstração',
    'gerente@demonstracao.com.br',
    'MANAGER'::"UserProfile",
    'scrypt$16384$8$1$ES7QHOHIcCPzS5JthM4hoA$Q5pNFHOxy0EJAjaaHPMTBYZfVv0B8iOP4NYtqBMpf1Jnfx83j6OUFoRyfIazLSPS0Yo1tzdNvvSP4siaBidYVg',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("email") DO UPDATE SET
  "name" = EXCLUDED."name",
  "profile" = EXCLUDED."profile",
  "password_hash" = EXCLUDED."password_hash",
  "updated_at" = CURRENT_TIMESTAMP;

-- Reset active sessions because rerunning this seed resets both demo passwords.
DELETE FROM "user_sessions"
WHERE "user_id" IN (
  SELECT "id"
  FROM "users"
  WHERE "email" IN ('admin@demonstracao.com.br', 'gerente@demonstracao.com.br')
);

INSERT INTO "coupons" (
  "id", "code", "discount_percent", "active", "starts_at", "expires_at", "created_at", "updated_at"
)
VALUES
  ('seed-coupon-5', 'CUPOM5', 5, TRUE, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed-coupon-10', 'CUPOM10', 10, TRUE, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed-coupon-15', 'CUPOM15', 15, TRUE, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed-coupon-20', 'CUPOM20', 20, TRUE, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed-coupon-25', 'CUPOM25', 25, TRUE, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed-coupon-30', 'CUPOM30', 30, TRUE, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed-coupon-50', 'CUPOM50', 50, TRUE, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "discount_percent" = EXCLUDED."discount_percent",
  "active" = EXCLUDED."active",
  "starts_at" = EXCLUDED."starts_at",
  "expires_at" = EXCLUDED."expires_at",
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "catalog_revision" ("id", "version", "updated_at")
VALUES ('main', 1, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
  "version" = "catalog_revision"."version" + 1,
  "updated_at" = CURRENT_TIMESTAMP;

COMMIT;

-- Expected counts for the records managed by this seed.
SELECT
  (SELECT COUNT(*) FROM "categories" WHERE "slug" IN ('executivos', 'bebidas', 'acompanhamentos')) AS "categories",
  (SELECT COUNT(*) FROM "products" WHERE "id" LIKE 'seed-product-%' OR "slug" IN (
    'bife-acebolado', 'frango-grelhado', 'frango-a-parmegiana', 'feijoada-executiva', 'carne-de-panela',
    'coca-cola-lata-350ml', 'guarana-antarctica-lata-350ml', 'suco-de-laranja-500ml',
    'agua-mineral-sem-gas-500ml', 'agua-mineral-com-gas-500ml', 'porcao-de-arroz',
    'porcao-de-feijao', 'batata-frita', 'salada-da-casa', 'farofa-temperada'
  )) AS "products",
  (SELECT COUNT(*) FROM "product_option_groups" WHERE "id" LIKE 'seed-pog-%') AS "option_groups",
  (SELECT COUNT(*) FROM "product_options" WHERE "id" LIKE 'seed-po-%') AS "options",
  (SELECT COUNT(*) FROM "users" WHERE "email" IN ('admin@demonstracao.com.br', 'gerente@demonstracao.com.br')) AS "users",
  (SELECT COUNT(*) FROM "coupons" WHERE "code" LIKE 'CUPOM%') AS "coupons";
