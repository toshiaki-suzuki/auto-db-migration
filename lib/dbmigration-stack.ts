import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambda_python from '@aws-cdk/aws-lambda-python-alpha';
import * as path from 'path';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { AuroraPostgresEngineVersion, ClusterInstance, DatabaseCluster, DatabaseClusterEngine, ServerlessCluster } from 'aws-cdk-lib/aws-rds';
import { InterfaceVpcEndpointAwsService, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';

export class DbmigrationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new Vpc(this, 'db-migration-vpc', {
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'isolated',
          subnetType: SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
      service: InterfaceVpcEndpointAwsService.SECRETS_MANAGER
    });

    const db = new DatabaseCluster(this, 'DbMigrationAuroraCluster', {
      engine: DatabaseClusterEngine.auroraPostgres({
        version: AuroraPostgresEngineVersion.VER_15_7,
      }),
      serverlessV2MinCapacity: 0,
      serverlessV2MaxCapacity: 1,
      writer: ClusterInstance.serverlessV2('writer'),
      readers: undefined,
      enableDataApi: true,
      iamAuthentication: false,
      storageEncrypted: true,
      vpc,
      vpcSubnets: vpc.selectSubnets({
        subnetType: SubnetType.PRIVATE_ISOLATED,
      }),
      clusterIdentifier: 'db-migration-aurora-cluster',
      defaultDatabaseName: 'db_migration',
      credentials: {
        username: 'postgres',
      },
    });

    const dbSecret = db.secret!;


    const layer = new lambda_python.PythonLayerVersion(this, "dbMigrationLayer", {
      layerVersionName: "db-migration-layer",
      entry: path.join(__dirname, 'lambda-layer'),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_11],
    });

    const handler = new lambda_python.PythonFunction(this, 'dbMigrationFunction', {
      functionName: 'db-migration-function',
      runtime: lambda.Runtime.PYTHON_3_11,
      entry: path.join(__dirname, 'lambda-functions', 'db_migration'),
      handler: 'lambda_handler',
      layers: [layer],
      vpc: vpc,
      vpcSubnets: { subnetType: SubnetType.PRIVATE_ISOLATED },
      environment: {
        DB_SECRET_NAME: dbSecret.secretArn,
      },
    });
    db.connections.allowDefaultPortFrom(handler);
    dbSecret.grantRead(handler);

    const provider = new Provider(this, "Provider", {
      onEventHandler: handler,
    });

    new cdk.CustomResource(this, "Custom::Migration", {
      serviceToken: provider.serviceToken,
      properties: { DummyValue: Date.now().toString() }, // ダミーのプロパティを設定してリソースの更新をトリガー
    });
  }
}
