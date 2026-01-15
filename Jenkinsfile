pipeline {
  agent any
  environment {
    SHEET_ID = '1Q98LFRr_Ka1ZyBKUJ6u1vJD67F_JHIs8eovklCX_dNY'
    GID = '593269429'
    XLSX_FILE = 'BMS_테이블_정의_V1.1.xlsx'
    DOCKER_PROJECT_NAME = 'cero'
    DOCKER_IMAGE_NAME = "db-naming-converter"
    GIT_KEY_ID = 'uinetworks-gitea-delploy-account'
    GIT_REPO_URL = 'https://github.com/CERO-SOLUTION/db-naming-converter.git'
    REGISTRY_URL = 'registry.zetra.kr'
    REGISTRY_LOGIN_INFO_ID = 'harbor_hjdev'
  }

  stages {
    stage('체크아웃') {
      steps {
        script {
          def BUILD_BRANCH = env.GIT_BRANCH == 'origin/dev' ? 'dev' : 'prod'
          git branch: BUILD_BRANCH, credentialsId: GIT_KEY_ID, url: GIT_REPO_URL
          env.BUILD_BRANCH = BUILD_BRANCH
        }
      }
    }

    stage('이미지 빌드') {
      steps {
        script {
          def BUILD_COMMAND = 'pnpm install && pnpm run build:dict && pnpm dev'
          def DOCKER_IMAGE = docker.build("${DOCKER_PROJECT_NAME}/${DOCKER_IMAGE_NAME}-${env.BUILD_BRANCH}", 
                                        "--build-arg BUILD_COMMAND=\"${BUILD_COMMAND}\" .")
          env.DOCKER_IMAGE = DOCKER_IMAGE.id
        }
      }
    }

    stage('이미지 전송') {
      steps {
        script {
          docker.withRegistry('https://registry.zetra.kr', REGISTRY_LOGIN_INFO_ID) {
            docker.image(env.DOCKER_IMAGE).push("${env.BUILD_NUMBER}")
            docker.image(env.DOCKER_IMAGE).push('latest')
          }
        }
      }
    }

    stage('컨테이너 배포') {
      when {
        expression { env.BUILD_BRANCH == 'dev' }
      }
      steps {
        sshPublisher(
          publishers: [
            sshPublisherDesc(
              configName: '241-login-key',
              transfers: [sshTransfer(sourceFiles: 'docker-compose.yml', remoteDirectory: 'containers/kits-control-dev')],
              execCommand: '''
                cd containers/kits-control-dev/
                DOCKER_IMAGE_NAME=registry.zetra.kr/cero/db-naming-converter-dev DOCKER_CONTAINER_NAME=db-naming-converter-dev docker compose pull
                DOCKER_IMAGE_NAME=registry.zetra.kr/cero/db-naming-converter-dev DOCKER_CONTAINER_NAME=db-naming-converter-dev docker compose up -d
              '''
            )
          ]
        )
      }
    }
  }
}
