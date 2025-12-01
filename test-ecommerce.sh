#!/bin/bash

echo "=============================================="
echo "        TESTE AUTOMÁTICO - ECOMMERCE"
echo "=============================================="
sleep 1

BASE_URL="http://localhost:8000"

###############################################################################
echo ""
echo "===== 1. Criando Usuário ====="
###############################################################################
sleep 1

curl --silent --request POST \
  --url $BASE_URL/users \
  --header "Content-Type: application/json" \
  --data '{
    "name": "João",
    "email": "joao@example.com",
    "password": "123456"
  }'

echo ""
echo "Listando usuários:"
curl --silent $BASE_URL/users
echo ""
sleep 2


###############################################################################
echo ""
echo "===== 2. Criando Produto ====="
###############################################################################
sleep 1

curl --silent --request POST \
  --url $BASE_URL/products \
  --header "Content-Type: application/json" \
  --data '{
    "name": "Notebook Gamer",
    "price": 4500,
    "stock": 10
  }'

echo ""
echo "Listando produtos:"
curl --silent $BASE_URL/products
echo ""
sleep 2


###############################################################################
echo ""
echo "===== 3. Criando Pedido ====="
###############################################################################
sleep 1

ORDER_RESPONSE=$(curl --silent --request POST \
  --url $BASE_URL/orders \
  --header "Content-Type: application/json" \
  --data '{
    "userId": 1,
    "products": [
      { "id": 1, "qty": 1 }
    ]
  }')

echo "Resposta do pedido:"
echo $ORDER_RESPONSE
echo ""

ORDER_ID=$(echo $ORDER_RESPONSE | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')

echo "Pedido criado. ID: $ORDER_ID"
echo ""
sleep 2

echo "Listando pedidos:"
curl --silent $BASE_URL/orders
echo ""
sleep 2


###############################################################################
echo ""
echo "===== 4. Métodos de Pagamento ====="
###############################################################################
sleep 1

curl --silent $BASE_URL/payments/methods
echo ""
sleep 2


###############################################################################
echo ""
echo "===== 5. Confirmando Pagamento ====="
###############################################################################
sleep 1

curl --silent --request POST \
  --url $BASE_URL/payments/confirm \
  --header "Content-Type: application/json" \
  --data "{
    \"orderId\": \"$ORDER_ID\",
    \"payments\": [
      { \"method\": \"PIX\", \"amount\": 4500 }
    ]
  }"

echo ""
echo "Buscando pagamento do pedido:"
curl --silent $BASE_URL/payments/order/$ORDER_ID
echo ""
sleep 2


###############################################################################
echo ""
echo "===== FIM DO TESTE ====="
echo "Tudo executado com sucesso!"
echo "=============================================="
###############################################################################