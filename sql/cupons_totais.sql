-- BIGNORDESTE ANALYTICS
-- Arquivo esperado: cupons_campanha.txt
-- Objetivo: medir alcance e penetracao de cada campanha na loja.
-- Troque :id_loja, :mes, :data_inicio e :data_fim antes de executar.

SELECT
    v.id_loja AS loja,
    ':mes' AS mes,
    (
        SELECT COUNT(DISTINCT v2.id)
        FROM pdv.venda v2
        WHERE v2.id_loja = :id_loja
          AND v2.data >= ':data_inicio'
          AND v2.data < ':data_fim'
          AND v2.cancelado = FALSE
    ) AS cupons_totais,
    t.descricao AS campanha,
    COUNT(DISTINCT v.id) AS cupons_campanha
FROM pdv.venda v
INNER JOIN pdv.vendaitem i
    ON i.id_venda = v.id
INNER JOIN public.tipooferta t
    ON t.id = i.id_tipooferta
WHERE v.id_loja = :id_loja
  AND v.data >= ':data_inicio'
  AND v.data < ':data_fim'
  AND v.cancelado = FALSE
  AND i.oferta = TRUE
GROUP BY
    v.id_loja,
    i.id_tipooferta,
    t.descricao
ORDER BY
    cupons_campanha DESC;
