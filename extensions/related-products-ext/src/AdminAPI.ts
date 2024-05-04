import { GraphQLError } from "@shopify/ui-extensions/build/ts/surfaces/admin/api/standard/standard";

type ApiVersion = "2023-04" | "2023-07" | "2023-10" | "unstable";

type Query = <Data = unknown, Variables = { [key: string]: unknown }>(
  query: string,
  options?: {
    variables?: Variables;
    version?: Exclude<ApiVersion, "2023-04">; // Changed Omit to Exclude
  }
) => Promise<{ data?: Data; errors?: GraphQLError[] }>;
export type Product = {
  id: string;
  title: string;
  tags: string[];
  collections: CollectionResponse | null;
};
type ProductResponse = {
  products: {
    edges: {
      node: Product;
    }[];
  };
};
export type Collection = {
  id: string;
  title: string;
};
type CollectionEdge = {
  node: Collection;
};
type CollectionResponse = {
  edges: CollectionEdge[];
};

export class AdminApi {
  query: Query;
  constructor(query: Query) {
    this.query = query;
  }
  async getCurrentProductWithTags(productId: string) {
    const result = await this.query<{
      product: Product;
    }>(`query
    {
      product(id:"${productId}") {
        id
        title
        tags
        collections(first: 250) {
          edges {
            node {
              id
              title
            }
          }
        }
      }
}`);
    if (result.data) {
      return result.data.product;
    } else {
      throw new Error(JSON.stringify(result.errors));
    }
  }

  async getAllProductsBasedOnTags(tag: string) {
    const result = await this.query<{
      products: {
        edges: {
          node: {
            id: string;
            title: string;
            tags: string[];
            collections: {
              edges: {
                node: {
                  id: string;
                  title: string;
                };
              }[];
            };
          };
        }[];
      };
    }>(`query {
      products(first: 250 ,query:"tag:${tag}") {
        edges {
          node {
            id
        title
        tags
        collections(first: 10) {
          edges {
            node {
              id
              title
            }
          }
        }
          }
        }
      }
    }`);
    if (result.data) {
      const productsResponse = result.data.products.edges.map(
        (edge) => edge.node
      );
      return productsResponse;
    } else {
      throw new Error(JSON.stringify(result.errors));
    }
  }
  async getAllProductsBasedOnCollections(collectionId: string) {
    const result = await this.query<{
      collection: {
        id: string;
        title: string;
        products: {
          edges: {
            node: {
              id: string;
              title: string;
              tags: string[];
              collections: {
                edges: {
                  node: {
                    id: string;
                    title: string;
                  };
                }[];
              };
            };
          }[];
        };
      };
    }>(`query {
      collection(id: "${collectionId}") {
        id
        title
        products(first: 250) {
          edges {
            node {
              id
              title
              tags
              collections(first: 250) {
                edges {
                  node {
                    id
                    title
                  }
                }
              }  
            }
          }
        }
      }
    }`);
    if (result.data) {
      return result.data.collection.products.edges.map((edge) => edge.node);
    } else {
      throw new Error(JSON.stringify(result.errors));
    }
  }
  async checkIfMetafieldExist() {
    const result = await this.query<{
      metafieldDefinitions: {
        edges: {
          node: {
            id: string | null;
            name: string | null;
            description: string | null;
          };
        }[];
      };
    }>(`
    query {
      metafieldDefinitions(first: 250, ownerType: PRODUCT, key: "related_products_") {
        edges {
          node {
            id
            name
            description
          }
        }
      }
    }`);

    if (result.data) {
      // console.log("data : " + JSON.stringify(result));
      return result;
    } else {
      throw new Error("Failed to check if batch metafield exist");
    }
  }
  async createMetafieldRelatedProductDefinition() {
    const result = await this.query<{
      metafieldDefinitionCreate: {
        createdDefinition: { id: string } | null;
        userErrors: { field: string; message: string; code: string }[];
      };
    }>(
      `mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
  metafieldDefinitionCreate(definition: $definition) {
    createdDefinition {
      id
      name	
    }
    userErrors {
      field
      message
      code
    }
  }
}`,
      {
        variables: {
          definition: {
            name: "related products",
            namespace: "custom",
            key: "related_products_",
            description:
              "Poduct that share similar tags or collections or even frequently bought togrther",
            type: "list.product_reference",
            ownerType: "PRODUCT",
          },
        },
      }
    );

    if (result.data) {
      // console.log("data : " + JSON.stringify(result));
      return result;
    } else {
      throw new Error("Failed to fetch SKUs");
    }
  }
  async pinMetafield(id: string) {
    const result = await this.query<{
      metafieldDefinitionPin: {
        pinnedDefinition: {
          name: string;
          key: string;
          namespace: string;
          pinnedPosition: number;
        };
        userErrors: { field: string; message: string; code: string }[];
      };
    }>(
      `mutation metafieldDefinitionPin($definitionId: ID!) {
        metafieldDefinitionPin(definitionId: $definitionId) {
          pinnedDefinition {
            name
            key
            namespace
            pinnedPosition
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          definitionId: id,
        },
      }
    );

    if (result.data) {
      // console.log("data : " + JSON.stringify(result));
      return result;
    } else {
      throw new Error("Failed to pin metafield");
    }
  }

  async createRelatedProduct(
    ids: string[],
    productId: string
    // metafieldId: string
  ) {
    const result = await this.query<{
      productUpdate: {
        product: {
          id: string;
          metafields: {
            edges: {
              node: {
                id: string;
                value: string;
                key: string;
                namespace: string;
              };
            }[];
          };
          product: {
            id: string;
          };
        };
      };
    }>(
      `mutation productUpdate($input: ProductInput!) {
    productUpdate(input: $input) {
      product {
        id
        metafields(first: 250) {
          edges {
            node {
              value
              key
              namespace
            }
          }
        }
      }
      userErrors {
        message
        field
      }
    }
  }`,
      {
        variables: {
          input: {
            id: productId,
            metafields: {
              namespace: "custom",
              value: JSON.stringify(ids),
              key: "related_products_",
              // id: metafieldId,
            },
          },
        },
      }
    );
    // console.log("result : " + JSON.stringify(result.data));
    // console.log("value :" + JSON.stringify(ids));
    if (result.data) {
      return result.data;
    } else {
      throw new Error(JSON.stringify(result.errors));
    }
  }
  async createRelatedProductIfMetafieldExist(
    ids: string[],
    productId: string,
    metafieldId: string
  ) {
    const result = await this.query<{
      productUpdate: {
        product: {
          id: string;
          metafields: {
            edges: {
              node: {
                id: string;
                value: string;
              };
            }[];
          };
        };
      };
    }>(
      `mutation productUpdate($input: ProductInput!) {
    productUpdate(input: $input) {
      product {
        id
        metafields(first: 250) {
          edges {
            node {
              value
              id
            }
          }
        }
      }
      userErrors {
        message
        field
      }
    }
  }`,
      {
        variables: {
          input: {
            id: productId,
            metafields: {
              value: JSON.stringify(ids),
              id: metafieldId,
            },
          },
        },
      }
    );
    // console.log("result if exist: " + JSON.stringify(result.data));
    // console.log("value :" + JSON.stringify(ids));
    if (result.data) {
      return result.data;
    } else {
      throw new Error(JSON.stringify(result.errors));
    }
  }

  async getCurrentProduct(id: string) {
    const result = await this.query<{
      product: {
        id: string;
        metafield: {
          id: string | null;
        };
      };
    }>(`query {
      product(id: "${id}") {
        id
        metafield(namespace:"custom",key:"related_products_"){
         id
        }
      }
    }`);
    if (result.data) {
      return result.data.product.metafield;
    } else {
      throw new Error(JSON.stringify(result.errors));
    }
  }

  async deleteProductformMetafieldRelatedProduct(
    ids: string[],
    productId: string,
    metafieldId: string
  ) {
    const result = await this.query<{
      productUpdate: {
        product: {
          id: string;
          metafields: {
            edges: {
              node: {
                id: string;
                value: string;
              };
            }[];
          };
        };
      };
    }>(
      `mutation productUpdate($input: ProductInput!) {
    productUpdate(input: $input) {
      product {
        id
        metafields(first: 250) {
          edges {
            node {
              value
              id
            }
          }
        }
      }
      userErrors {
        message
        field
      }
    }
  }`,
      {
        variables: {
          input: {
            id: productId,
            metafields: {
              value: JSON.stringify(ids),
              id: metafieldId,
            },
          },
        },
      }
    );
    if (result.data) {
      return result.data;
    } else {
      throw new Error(JSON.stringify(result.errors));
    }
  }

}
